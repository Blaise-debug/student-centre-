import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import {
  AcademicProfileDraft,
  completeAcademicProfile,
  lookupCourseCode,
} from '../../services/academic-profile.service';

const LEVELS = ['Undergraduate', 'Postgraduate', 'Diploma', 'Certificate', 'Other'];
const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Other'];

const emptyDraft: AcademicProfileDraft = {
  country: '',
  institution: '',
  levelOfStudy: '',
  yearOfStudy: '',
  program: '',
  mainUnits: [],
  commonUnits: [],
  otherUnits: [],
};

const UNIT_GROUPS = [
  { key: 'mainUnits', label: 'Main units', action: 'Add main units', placeholder: 'e.g. BCS 214' },
  { key: 'commonUnits', label: 'Common units', action: 'Add common units', placeholder: 'e.g. Communication Skills' },
  { key: 'otherUnits', label: 'Other units', action: 'Add other units', placeholder: 'e.g. Entrepreneurship' },
] as const;

type UnitCategory = (typeof UNIT_GROUPS)[number]['key'];

export default function OnboardingScreen() {
  const { refreshUser, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AcademicProfileDraft>(emptyDraft);
  const [otherLevel, setOtherLevel] = useState('');
  const [otherYear, setOtherYear] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [unitInput, setUnitInput] = useState('');
  const [activeUnitCategory, setActiveUnitCategory] = useState<UnitCategory>('mainUnits');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || user?.username || 'there';

  const levelValue = draft.levelOfStudy === 'Other' ? otherLevel.trim() : draft.levelOfStudy;
  const yearValue = draft.yearOfStudy === 'Other' ? otherYear.trim() : draft.yearOfStudy;
  const allUnits = useMemo(
    () => [...draft.mainUnits, ...draft.commonUnits, ...draft.otherUnits],
    [draft.mainUnits, draft.commonUnits, draft.otherUnits]
  );

  function updateDraft<K extends keyof AcademicProfileDraft>(key: K, value: AcademicProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrorMessage('');
  }

  function continueFromDetails() {
    const details = [draft.country, draft.institution, levelValue, yearValue, draft.program];
    if (details.some((value) => !value.trim())) {
      setErrorMessage('Complete each academic detail to continue.');
      return;
    }
    if (draft.country.trim().length > 80 || draft.institution.trim().length > 120 ||
        levelValue.length > 40 || yearValue.length > 30 || draft.program.trim().length > 120) {
      setErrorMessage('Some details are too long. Shorten them and try again.');
      return;
    }
    updateDraft('levelOfStudy', levelValue);
    updateDraft('yearOfStudy', yearValue);
    setStep(2);
  }

  function addUnit(category: UnitCategory) {
    const unit = unitInput.trim();
    if (!unit) return;
    if (unit.length > 60) {
      setErrorMessage('Course unit names must be 60 characters or fewer.');
      return;
    }
    if (draft[category].length >= 20) {
      setErrorMessage('You can add up to 20 units in each group.');
      return;
    }
    if (allUnits.some((existing) => existing.toLocaleLowerCase() === unit.toLocaleLowerCase())) {
      setErrorMessage('That unit is already in the list.');
      return;
    }

    setDraft((current) => ({ ...current, [category]: [...current[category], unit] }));
    setUnitInput('');
    setErrorMessage('');
  }

  function continueFromUnits() {
    if (allUnits.length === 0) {
      setErrorMessage('Add at least one main, common, or other course unit.');
      return;
    }
    setErrorMessage('');
    setStep(1);
  }

  function removeUnit(category: UnitCategory, unit: string) {
    setDraft((current) => ({
      ...current,
      [category]: current[category].filter((value) => value !== unit),
    }));
  }

  async function applyCourseCode() {
    const code = courseCode.trim().toUpperCase();
    if (!/^[A-F0-9]{16}$/.test(code)) {
      setErrorMessage('Course codes contain 16 letters or numbers.');
      return;
    }

    setErrorMessage('');
    setLookupMessage('');
    setIsLookingUp(true);
    try {
      const details = await lookupCourseCode(code);
      setDraft(details);
      setActiveUnitCategory(details.mainUnits.length ? 'mainUnits' : details.commonUnits.length ? 'commonUnits' : 'otherUnits');
      setUnitInput('');
      setOtherLevel('');
      setOtherYear('');
      setLookupMessage('Course details and units loaded. Review or edit them before continuing.');
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setErrorMessage(apiError.response?.data?.message || 'Unable to load that course code. Check it and try again.');
    } finally {
      setIsLookingUp(false);
    }
  }

  async function saveProfile() {
    if (allUnits.length === 0) {
      setErrorMessage('Add at least one main, common, or other course unit.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await completeAcademicProfile({
        ...draft,
        country: draft.country.trim(),
        institution: draft.institution.trim(),
        levelOfStudy: levelValue,
        yearOfStudy: yearValue,
        program: draft.program.trim(),
      });
      // Refreshing the authenticated user updates RootNavigator. Once the API
      // marks onboarding complete, the authenticated route becomes Home.
      await refreshUser();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setErrorMessage(apiError.response?.data?.message || 'Your profile may have been saved, but we could not finish opening Student Centre. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderUnitEditor(category: UnitCategory) {
    const group = UNIT_GROUPS.find((item) => item.key === category)!;
    const units = draft[category];
    return (
      <View style={styles.unitSection}>
        <Text style={styles.fieldLabel}>{group.label}</Text>
        <View style={styles.addUnitRow}>
          <TextInput
            style={[styles.input, styles.unitInput]}
            value={unitInput}
            onChangeText={setUnitInput}
            placeholder={group.placeholder}
            placeholderTextColor={colors.textSecondary}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={() => addUnit(category)}
          />
          <TouchableOpacity
            style={styles.addUnitButton}
            onPress={() => addUnit(category)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${group.label.toLowerCase()}`}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
        {units.length === 0 ? (
          <Text style={styles.emptyUnits}>No {group.label.toLowerCase()} added yet.</Text>
        ) : units.map((unit) => (
            <View key={`${category}-${unit}`} style={styles.unitChip}>
              <Text style={styles.unitChipText}>{unit}</Text>
              <TouchableOpacity
                onPress={() => removeUnit(category, unit)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${unit}`}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={21} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
      </View>
    );
  }

  function renderWelcomeAndUnits() {
    return (
      <>
        <View style={styles.illustrationPanel} accessible accessibilityLabel="Student Centre study illustration">
          <View style={styles.illustrationGlow} />
          <View style={styles.illustrationIconCircle}>
            <Ionicons name="school-outline" size={56} color={colors.primaryDark} />
          </View>
          <View style={styles.illustrationBookBadge}>
            <Ionicons name="book-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.illustrationCheckBadge}>
            <Ionicons name="checkmark" size={17} color={colors.white} />
          </View>
          <Text style={styles.illustrationCaption}>Learn, connect, grow</Text>
        </View>

        <Text style={styles.welcomeTitle}>Hi, {firstName}!</Text>
        <Text style={styles.welcomeCopy}>
          We’re grateful to have you here. Please take some time to register your course units so Student Centre can work effectively for you.
        </Text>

        <Text style={styles.fieldLabel}>Add your course units</Text>
        <Text style={styles.helperText}>Choose a category, then add each unit. You can add up to 20 units in each group.</Text>
        <View style={styles.categoryButtonStack}>
          {UNIT_GROUPS.map((group) => {
            const selected = activeUnitCategory === group.key;
            const isMain = group.key === 'mainUnits';
            const count = draft[group.key].length;
            return (
              <TouchableOpacity
                key={group.key}
                style={[
                  styles.categoryButton,
                  isMain && styles.categoryButtonPrimary,
                  selected && !isMain && styles.categoryButtonSelected,
                ]}
                onPress={() => {
                  setActiveUnitCategory(group.key);
                  setUnitInput('');
                  setErrorMessage('');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Ionicons
                  name={count > 0 ? 'checkmark-circle' : 'add-circle-outline'}
                  size={22}
                  color={isMain ? colors.white : colors.primaryDark}
                />
                <Text style={[styles.categoryButtonText, isMain && styles.categoryButtonPrimaryText]}>
                  {group.action}
                </Text>
                <Text style={[styles.categoryCount, isMain && styles.categoryButtonPrimaryText]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {renderUnitEditor(activeUnitCategory)}

        <View style={styles.courseCodeCard}>
          <Text style={styles.courseCodeTitle}>Have a peer’s course setup code?</Text>
          <Text style={styles.courseCodeDescription}>Enter it to load their unit categories, then review or edit the list.</Text>
          <View style={styles.addUnitRow}>
            <TextInput
              style={[styles.input, styles.unitInput]}
              value={courseCode}
              onChangeText={(value) => setCourseCode(value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 16))}
              placeholder="16-character code"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              maxLength={16}
              editable={!isLookingUp}
            />
            <TouchableOpacity style={styles.lookupButton} onPress={applyCourseCode} disabled={isLookingUp}>
              {isLookingUp ? <ActivityIndicator color={colors.white} /> : <Text style={styles.lookupButtonText}>Apply</Text>}
            </TouchableOpacity>
          </View>
          {lookupMessage ? <Text style={styles.successMessage}>{lookupMessage}</Text> : null}
        </View>
      </>
    );
  }

  function renderAcademicDetails() {
    return (
      <>
        <Text style={styles.stepTitle}>Your academic path</Text>
        <Text style={styles.stepSubtitle}>This helps us connect you with relevant students and course communities.</Text>

        <Text style={styles.fieldLabel}>Country</Text>
        <TextInput style={styles.input} value={draft.country} onChangeText={(value) => updateDraft('country', value)} placeholder="Enter your country" placeholderTextColor={colors.textSecondary} autoCapitalize="words" maxLength={80} />

        <Text style={styles.fieldLabel}>Institution</Text>
        <TextInput style={styles.input} value={draft.institution} onChangeText={(value) => updateDraft('institution', value)} placeholder="University, college, or school" placeholderTextColor={colors.textSecondary} autoCapitalize="words" maxLength={120} />

        <Text style={styles.fieldLabel}>Level of study</Text>
        <View style={styles.choiceWrap}>
          {LEVELS.map((level) => (
            <Choice key={level} label={level} selected={draft.levelOfStudy === level} onPress={() => updateDraft('levelOfStudy', level)} />
          ))}
        </View>
        {draft.levelOfStudy === 'Other' ? (
          <TextInput style={styles.input} value={otherLevel} onChangeText={setOtherLevel} placeholder="Enter your level" placeholderTextColor={colors.textSecondary} maxLength={40} />
        ) : null}

        <Text style={styles.fieldLabel}>Year of study</Text>
        <View style={styles.choiceWrap}>
          {YEARS.map((year) => (
            <Choice key={year} label={year} selected={draft.yearOfStudy === year} onPress={() => updateDraft('yearOfStudy', year)} />
          ))}
        </View>
        {draft.yearOfStudy === 'Other' ? (
          <TextInput style={styles.input} value={otherYear} onChangeText={setOtherYear} placeholder="Enter your year or term" placeholderTextColor={colors.textSecondary} maxLength={30} />
        ) : null}

        <Text style={styles.fieldLabel}>Course or programme</Text>
        <TextInput style={styles.input} value={draft.program} onChangeText={(value) => updateDraft('program', value)} placeholder="e.g. Software Engineering" placeholderTextColor={colors.textSecondary} autoCapitalize="words" maxLength={120} />
      </>
    );
  }

  function renderReview() {
    return (
      <>
        <Text style={styles.stepTitle}>Review your details</Text>
        <Text style={styles.stepSubtitle}>Check the information before we save your student profile.</Text>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeadingRow}>
            <Text style={styles.reviewHeading}>Academic profile</Text>
            <TouchableOpacity onPress={() => setStep(1)}><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
          </View>
          <ReviewRow label="Country" value={draft.country} />
          <ReviewRow label="Institution" value={draft.institution} />
          <ReviewRow label="Level" value={levelValue} />
          <ReviewRow label="Year" value={yearValue} />
          <ReviewRow label="Course" value={draft.program} />
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeadingRow}>
            <Text style={styles.reviewHeading}>Course units</Text>
            <TouchableOpacity onPress={() => setStep(0)}><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
          </View>
          <ReviewList label="Main units" values={draft.mainUnits} />
          <ReviewList label="Common units" values={draft.commonUnits} />
          <ReviewList label="Other units" values={draft.otherUnits} />
        </View>
        <Text style={styles.helperText}>Home starts with your first main unit, or the first common or other unit if you have not added a main unit. You can change it at any time.</Text>
      </>
    );
  }

  function renderStep() {
    if (step === 0) {
      return renderWelcomeAndUnits();
    }
    return step === 1 ? renderAcademicDetails() : renderReview();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>Student Centre</Text>
        <Text style={styles.progress}>Step {step + 3} of 5</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((step + 3) / 5) * 100}%` }]} /></View>
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {renderStep()}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.footerActions}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backButton} onPress={() => { setErrorMessage(''); setStep(step - 1); }}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={step === 0 ? continueFromUnits : step === 1 ? continueFromDetails : saveProfile}
            disabled={(step === 0 && isLookingUp) || (step === 2 && isSubmitting)}
          >
            {(step === 2 && isSubmitting) || (step === 0 && isLookingUp) ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>{step === 2 ? 'Confirm & get started' : 'Continue'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>;
}

function ReviewList({ label, values }: { label: string; values: string[] }) {
  return (
    <View style={styles.reviewList}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{values.length ? values.join(', ') : 'None added'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: Platform.OS === 'android' ? 28 : 14, paddingHorizontal: 24, paddingBottom: 14, backgroundColor: colors.background },
  brand: { color: colors.primary, fontWeight: '700', fontSize: 19 },
  progress: { marginTop: 18, color: colors.textSecondary, fontWeight: '600' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surface, marginTop: 9, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  scrollArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  illustrationPanel: { height: 166, marginTop: 8, marginBottom: 18, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  illustrationGlow: { position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: '#EAF5E4', top: -54, right: -18 },
  illustrationIconCircle: { width: 94, height: 94, borderRadius: 47, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  illustrationBookBadge: { position: 'absolute', left: '27%', top: 24, width: 44, height: 44, borderRadius: 15, backgroundColor: '#EAF5E4', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  illustrationCheckBadge: { position: 'absolute', right: '28%', bottom: 43, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  illustrationCaption: { position: 'absolute', bottom: 12, color: colors.primaryDark, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  welcomeTitle: { color: colors.textPrimary, fontSize: 25, lineHeight: 31, fontWeight: '800' },
  welcomeCopy: { marginTop: 7, color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  stepTitle: { marginTop: 8, color: colors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  stepSubtitle: { marginTop: 7, marginBottom: 20, color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
  fieldLabel: { marginTop: 14, marginBottom: 7, color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 50, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontSize: 15, marginBottom: 4 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  choice: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.surfaceLight },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: colors.white },
  categoryButtonStack: { gap: 9, marginTop: 10 },
  categoryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLight },
  categoryButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryButtonSelected: { borderWidth: 2, borderColor: colors.primaryDark },
  categoryButtonText: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  categoryButtonPrimaryText: { color: colors.white },
  categoryCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  addUnitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitInput: { flex: 1, marginBottom: 0 },
  lookupButton: { height: 50, minWidth: 76, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  lookupButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  successMessage: { color: colors.primaryDark, fontSize: 13, marginTop: 8, lineHeight: 18 },
  manualHeading: { marginTop: 22, color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  unitSection: { marginTop: 6 },
  addUnitButton: { width: 50, height: 50, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  unitChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9, marginTop: 8, backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  unitChipText: { flex: 1, color: colors.textPrimary, fontSize: 14, marginRight: 10 },
  emptyUnits: { marginTop: 8, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  helperText: { marginTop: 7, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  courseCodeCard: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  courseCodeTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  courseCodeDescription: { marginTop: 4, marginBottom: 10, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  reviewCard: { padding: 15, marginBottom: 12, borderRadius: 12, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  reviewHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewHeading: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  editLink: { color: colors.primaryDark, fontWeight: '700', padding: 5 },
  reviewRow: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.background },
  reviewLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  reviewValue: { marginTop: 3, color: colors.textPrimary, fontSize: 15, lineHeight: 21 },
  reviewList: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.background },
  error: { marginTop: 12, color: colors.danger, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  footerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { minWidth: 92, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 },
  backButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  primaryButton: { flex: 1, minHeight: 54, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
