/**
 * Upload ID — Step 1 of 2 (Suki customer identity verification)
 * =============================================================
 * Captures a Philippine government ID, runs the on-device OCR pipeline
 * (`useIdOcr` -> pre-process -> ML Kit -> pure parser), auto-fills the editable
 * KYC fields, lets the user verify/correct them, then submits the photo + parsed
 * fields to the backend before routing to face verification.
 *
 * Architecture: ALL OCR logic lives in `@/features/customer/ocr` — this screen
 * only orchestrates capture, binds fields, and submits.
 *
 * PII: raw OCR text is never logged. It is retained only to be POSTed for
 * server-side audit/re-parse, then discarded with the component.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import {
  ChevronLeft, ChevronRight, Camera, ScanLine, CheckCircle2,
  AlertTriangle, ShieldCheck, RefreshCw,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Chip } from '@/components/atoms';
import { Button } from '@/components/atoms/Button/Button';
import { Card } from '@/components/atoms/Card';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { useAppDialog } from '@/hooks';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useThemeMode } from '@/core/theme';
import { api, extractApiError } from '@/core/api';
import {
  useIdOcr,
  IdCameraOverlay,
  type PhDocumentType,
  type IdSex,
  type FieldConfidence,
  type IdOcrResult,
} from '@/features/customer/ocr';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

// ── Document type options (label + value for the selector) ───────────────────
const DOC_TYPES: ReadonlyArray<{ value: PhDocumentType; label: string }> = [
  { value: 'PHILSYS_ID',      label: 'PhilSys / PhilID' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  { value: 'SSS_UMID',        label: 'SSS / UMID' },
  { value: 'PASSPORT',        label: 'Passport' },
  { value: 'PHILHEALTH',      label: 'PhilHealth' },
  { value: 'GENERIC_ID',      label: 'Other Gov ID' },
];

const SEX_OPTIONS: ReadonlyArray<{ value: IdSex; label: string }> = [
  { value: 'MALE',   label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];

/** Tracks which fields the OCR populated (for the "auto-filled" affordance). */
interface AutoFilledFlags {
  fullName: boolean;
  birthDate: boolean;
  idNumber: boolean;
  address: boolean;
  sex: boolean;
}

const NO_AUTOFILL: AutoFilledFlags = {
  fullName: false, birthDate: false, idNumber: false, address: false, sex: false,
};

export default function VerifyIdScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const ocr = useIdOcr();

  // ── Editable form fields (auto-filled from OCR, fully user-editable) ───────
  const [documentType, setDocumentType] = useState<PhDocumentType>('PHILSYS_ID');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [sex, setSex] = useState<IdSex | ''>('');
  const [autoFilled, setAutoFilled] = useState<AutoFilledFlags>(NO_AUTOFILL);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // ── Dynamic tokens ─────────────────────────────────────────────────────────
  const rootBg: string        = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg: string        = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder: string    = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const textPrimary: string   = isDark ? '#F1F5F9' : '#0F172A';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : '#64748B';
  const inputBg: string       = isDark ? '#1E2435' : '#FAFBFD';
  const inputBorder: string   = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string     = isDark ? '#F1F5F9' : '#111111';
  const placeholderColor: string = isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8';
  const scanZoneBg: string    = isDark ? 'rgba(79,158,255,0.06)' : '#F2F7FF';
  const scanFrameBorder: string = isDark ? 'rgba(79,158,255,0.30)' : 'rgba(30,77,140,0.28)';
  const instrBoxBg: string    = isDark ? 'rgba(79,158,255,0.10)' : '#EFF6FF';
  const instrTitleColor: string = isDark ? '#4F9EFF' : NAVY;
  const labelColor: string    = isDark ? '#E2E8F0' : '#243B53';
  const scanAccent: string    = isDark ? '#4F9EFF' : NAVY;
  const autofillTagBg: string = isDark ? 'rgba(39,174,96,0.18)' : '#E8F8EF';
  const dividerColor: string  = isDark ? 'rgba(255,255,255,0.08)' : '#EAF0F7';

  const imageUri = ocr.result?.imageUri ?? null;

  /** Apply parsed OCR fields to the editable form. Only fills present fields. */
  const applyParsed = useCallback(() => {
    const res = ocr.result;
    if (!res) return;
    const p = res.parsed;
    const flags: AutoFilledFlags = { ...NO_AUTOFILL };

    setDocumentType(p.documentType);
    if (p.fullName)  { setFullName(p.fullName.value);  flags.fullName = true; }
    if (p.birthDate) { setBirthDate(p.birthDate.value); flags.birthDate = true; }
    if (p.idNumber)  { setIdNumber(p.idNumber.value);  flags.idNumber = true; }
    if (p.address)   { setAddress(p.address.value);    flags.address = true; }
    if (p.sex)       { setSex(p.sex.value);            flags.sex = true; }
    setAutoFilled(flags);

    // Surface a "please verify" hint when any signal is weak.
    const weak: FieldConfidence[] = [
      p.documentTypeConfidence,
      ...(p.fullName ? [p.fullName.confidence] : []),
      ...(p.birthDate ? [p.birthDate.confidence] : []),
      ...(p.idNumber ? [p.idNumber.confidence] : []),
    ];
    setLowConfidence(weak.some((c) => c === 'low') || !res.ocrAvailable);
  }, [ocr.result]);

  // Re-apply whenever a fresh OCR result lands.
  useEffect(() => { applyParsed(); }, [applyParsed]);

  /** Open the in-app camera (custom overlay + on-device quality gate). */
  const handleCapture = useCallback(() => {
    setShowCamera(true);
  }, []);

  /** Gate passed (`quality.status === 'ok'`): close the camera; fields auto-fill
   *  from `ocr.result` via the `applyParsed` effect. */
  const handleCameraConfirmed = useCallback((res: IdOcrResult) => {
    setShowCamera(false);
    if (!res.ocrAvailable) {
      dialog.show({
        variant: 'info',
        title: 'Enter details manually',
        message:
          'Automatic scanning is unavailable on this device. Please type the details exactly as shown on your ID.',
      });
    }
  }, [dialog]);

  /** User opted out of the retake loop: keep the captured image, type by hand. */
  const handleManualEntry = useCallback((_res: IdOcrResult | null) => {
    setShowCamera(false);
    dialog.show({
      variant: 'info',
      title: 'Enter details manually',
      message: 'Please type the details exactly as shown on your ID, then continue.',
    });
  }, [dialog]);

  // Surface async OCR errors (e.g. permission denied) raised outside the await.
  // Skipped while the camera overlay is open — it owns its own error/retake UI.
  useEffect(() => {
    if (!showCamera && ocr.status === 'error' && ocr.error) {
      dialog.show({ variant: 'error', title: 'Scan failed', message: ocr.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocr.status]);

  const handleSubmit = async () => {
    if (!customer) return;
    if (!imageUri) {
      dialog.show({ variant: 'error', title: 'No photo', message: 'Please take a photo of your ID first.' });
      return;
    }
    if (!fullName.trim()) {
      dialog.show({ variant: 'error', title: 'Required', message: 'Please enter your full name as shown on the ID.' });
      return;
    }
    setIsUploading(true);
    try {
      const sessionToken = await SecureStore.getItemAsync('suki_customer_session_token').catch(() => null);

      // POST /customers/verify/upload-id — multipart. Field keys are kept
      // backward-compatible; new KYC fields are optional additions.
      const formData = new FormData();
      formData.append('file', { uri: imageUri, name: 'id_front.jpg', type: 'image/jpeg' } as unknown as Blob);
      formData.append('customerId', customer.id);
      formData.append('documentType', documentType);
      if (sessionToken) formData.append('sessionToken', sessionToken);
      formData.append('ocrFullName', fullName.trim());
      if (birthDate.trim()) formData.append('ocrBirthDate', birthDate.trim());
      if (idNumber.trim()) formData.append('ocrIdNumber', idNumber.trim());
      if (address.trim()) formData.append('ocrAddress', address.trim());
      if (sex) formData.append('ocrSex', sex);
      // Raw text retained for server-side audit/re-parse. Never logged client-side.
      if (ocr.result?.rawText) formData.append('ocrRawText', ocr.result.rawText);

      await api.post('/customers/verify/upload-id', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      router.replace('/(customer)/verify-liveness');
    } catch (err) {
      const { code, detail } = extractApiError(err);
      dialog.show({ variant: 'error', title: 'Upload failed', message: detail ?? code ?? 'Please try again.' });
    } finally {
      setIsUploading(false);
    }
  };

  const isBusy = ocr.isBusy;
  const hasScan = !!imageUri;
  const processingLabel = useMemo(
    () => (ocr.status === 'capturing' ? 'Opening camera…' : 'Reading your ID…'),
    [ocr.status],
  );

  /** Small "Auto-filled — please verify" pill rendered beside a field label. */
  const AutoFilledTag = ({ shown }: { shown: boolean }) =>
    shown ? (
      <View style={[styles.autofillTag, { backgroundColor: autofillTagBg }]}>
        <CheckCircle2 size={11} color={GREEN} />
        <Text style={[styles.autofillTagText, { color: GREEN }]}>Auto-filled — verify</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.brandStripe}>
            <View style={[styles.stripe, { backgroundColor: NAVY }]} />
            <View style={[styles.stripe, { backgroundColor: AMBER }]} />
            <View style={[styles.stripe, { backgroundColor: GREEN }]} />
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={18} color="rgba(255,255,255,0.85)" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerEyebrow}>STEP 1 OF 2</Text>
          <Text style={styles.headerTitle}>Upload your ID</Text>
          <Text style={styles.headerSubtitle}>
            We read it on your device and pre-fill the details for you.
          </Text>

          {/* Two-step flow progress (this screen = step 1, half complete) */}
          <View style={styles.stepRow}>
            <ProgressBar
              fraction={0.5}
              color={AMBER}
              trackColor="rgba(255,255,255,0.22)"
              height={6}
              style={styles.stepSegment}
            />
            <ProgressBar
              fraction={0}
              color={AMBER}
              trackColor="rgba(255,255,255,0.22)"
              height={6}
              style={styles.stepSegment}
            />
          </View>
          <View style={styles.stepLabelsRow}>
            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Upload ID</Text>
            <Text style={styles.stepLabel}>Face Verification</Text>
          </View>
        </View>

        {/* ── Scan card ──────────────────────────────────────────────────── */}
        <Card variant="elevated" shadow="md" padding="lg" borderRadius="xl" style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }]}>
          <View style={[styles.instrBox, { backgroundColor: instrBoxBg }]}>
            <ScanLine size={18} color={instrTitleColor} />
            <View style={styles.instrTextWrap}>
              <Text style={[styles.instrTitle, { color: instrTitleColor }]}>Philippine Government ID</Text>
              <Text style={[styles.instrText, { color: textSecondary }]}>
                Use a clear, well-lit photo (PhilSys, Driver&apos;s License, SSS/UMID, Passport, PhilHealth).
                Fill the frame and keep all text readable.
              </Text>
            </View>
          </View>

          {/* Scan hero — ID-card aspect capture zone with corner guides */}
          <TouchableOpacity
            style={[
              styles.scanZone,
              { backgroundColor: scanZoneBg, borderColor: hasScan ? GREEN : scanFrameBorder },
            ]}
            onPress={handleCapture}
            activeOpacity={0.85}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={hasScan ? 'ID photo captured. Tap to retake.' : 'Take a photo of your ID'}
          >
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.idPreview} />
                {!isBusy && (
                  <View style={styles.scannedBadge}>
                    <CheckCircle2 size={14} color="#FFFFFF" />
                    <Text style={styles.scannedBadgeText}>Scanned</Text>
                  </View>
                )}
                {isBusy && (
                  <View style={styles.scanBusyOverlay}>
                    <ActivityIndicator color="#FFFFFF" size="large" />
                    <Text style={styles.scanBusyText}>{processingLabel}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Corner guides */}
                <View style={[styles.corner, styles.cornerTL, { borderColor: scanAccent }]} />
                <View style={[styles.corner, styles.cornerTR, { borderColor: scanAccent }]} />
                <View style={[styles.corner, styles.cornerBL, { borderColor: scanAccent }]} />
                <View style={[styles.corner, styles.cornerBR, { borderColor: scanAccent }]} />
                <View style={styles.scanPlaceholder}>
                  {isBusy ? (
                    <>
                      <ActivityIndicator color={scanAccent} size="large" />
                      <Text style={[styles.scanLabel, { color: scanAccent }]}>{processingLabel}</Text>
                    </>
                  ) : (
                    <>
                      <View style={[styles.scanIconRing, { borderColor: scanAccent }]}>
                        <Camera size={26} color={scanAccent} />
                      </View>
                      <Text style={[styles.scanLabel, { color: scanAccent }]}>Take Photo of ID</Text>
                      <Text style={[styles.scanHint, { color: textSecondary }]}>Align your ID inside the frame</Text>
                    </>
                  )}
                </View>
              </>
            )}
          </TouchableOpacity>

          {hasScan && !isBusy && (
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleCapture}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
            >
              <RefreshCw size={14} color={scanAccent} />
              <Text style={[styles.retakeBtnText, { color: scanAccent }]}>Retake Photo</Text>
            </TouchableOpacity>
          )}

          {lowConfidence && hasScan && (
            <View style={styles.warnBox}>
              <AlertTriangle size={16} color={AMBER} style={styles.warnIcon} />
              <Text style={styles.warnText}>
                A few details may not have been read perfectly. Please double-check each field below.
              </Text>
            </View>
          )}
        </Card>

        {/* ── Review card ────────────────────────────────────────────────── */}
        <Card variant="elevated" shadow="md" padding="lg" borderRadius="xl" style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }]}>
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewTitle, { color: textPrimary }]}>Review your details</Text>
            <Text style={[styles.reviewSubtitle, { color: textSecondary }]}>
              {hasScan ? 'Confirm everything matches your ID.' : 'Take a photo to auto-fill these fields, or type them in.'}
            </Text>
          </View>

          {/* Fields are de-emphasized until a scan exists, but remain reachable. */}
          <View style={!hasScan && styles.fieldsIdle}>
            {/* ── Document Type ─────────────────────────────────────────── */}
            <Text style={[styles.fieldLabel, { color: labelColor }]}>Document Type *</Text>
            <View style={styles.chipRow}>
              {DOC_TYPES.map((d) => (
                <Chip
                  key={d.value}
                  label={d.label}
                  size="md"
                  variant="outlined"
                  color="primary"
                  selected={documentType === d.value}
                  onPress={() => setDocumentType(d.value)}
                  style={styles.chip}
                />
              ))}
            </View>

            <View style={[styles.fieldDivider, { backgroundColor: dividerColor }]} />

            {/* ── Full Name (required) ──────────────────────────────────── */}
            <View style={styles.labelRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelInline, { color: labelColor }]}>Full Name (as on ID) *</Text>
              <AutoFilledTag shown={autoFilled.fullName} />
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Dela Cruz, Juan P."
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={120}
              placeholderTextColor={placeholderColor}
            />

            {/* ── Birthdate (optional) ──────────────────────────────────── */}
            <View style={styles.labelRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelInline, { color: labelColor }]}>Birthdate <Text style={[styles.optional, { color: textSecondary }]}>· optional</Text></Text>
              <AutoFilledTag shown={autoFilled.birthDate} />
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="YYYY-MM-DD (e.g. 1990-01-01)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              placeholderTextColor={placeholderColor}
            />

            {/* ── ID Number (optional) ──────────────────────────────────── */}
            <View style={styles.labelRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelInline, { color: labelColor }]}>ID Number <Text style={[styles.optional, { color: textSecondary }]}>· optional</Text></Text>
              <AutoFilledTag shown={autoFilled.idNumber} />
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
              value={idNumber}
              onChangeText={(t) => setIdNumber(t.toUpperCase())}
              placeholder="PCN / License No. / CRN"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={30}
              placeholderTextColor={placeholderColor}
            />

            {/* ── Sex (optional) ────────────────────────────────────────── */}
            <View style={styles.labelRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelInline, { color: labelColor }]}>Sex <Text style={[styles.optional, { color: textSecondary }]}>· optional</Text></Text>
              <AutoFilledTag shown={autoFilled.sex} />
            </View>
            <View style={styles.chipRow}>
              {SEX_OPTIONS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  size="md"
                  variant="outlined"
                  color="primary"
                  selected={sex === s.value}
                  onPress={() => setSex((cur) => (cur === s.value ? '' : s.value))}
                  style={styles.chip}
                />
              ))}
            </View>

            {/* ── Address (optional) ────────────────────────────────────── */}
            <View style={styles.labelRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelInline, { color: labelColor }]}>Address <Text style={[styles.optional, { color: textSecondary }]}>· optional</Text></Text>
              <AutoFilledTag shown={autoFilled.address} />
            </View>
            <TextInput
              style={[
                styles.input,
                styles.inputMultiline,
                { backgroundColor: inputBg, borderColor: inputBorder, color: inputText },
              ]}
              value={address}
              onChangeText={setAddress}
              placeholder="House/Unit, Street, Barangay, City"
              autoCapitalize="words"
              autoCorrect={false}
              multiline
              maxLength={200}
              placeholderTextColor={placeholderColor}
            />
          </View>

          <View style={styles.privacyRow}>
            <ShieldCheck size={15} color={GREEN} style={styles.privacyIcon} />
            <Text style={[styles.privacyNote, { color: textSecondary }]}>
              Your ID is read on this device. We only send the details you confirm above to complete verification.
            </Text>
          </View>
        </Card>

        {/* ── Primary CTA ────────────────────────────────────────────────── */}
        <View style={styles.ctaWrap}>
          <Button
            title="Next: Face Verification"
            onPress={handleSubmit}
            fullWidth
            size="lg"
            loading={isUploading}
            disabled={isUploading || !imageUri || isBusy}
            rightIcon={<ChevronRight size={18} color="#FFFFFF" style={styles.ctaIcon} />}
          />
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      <IdCameraOverlay
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onConfirmed={handleCameraConfirmed}
        onManualEntry={handleManualEntry}
        recognize={ocr.recognizeFromUri}
      />
      {dialog.Dialog}
    </SafeAreaView>
  );
}

// ── Layout constants ─────────────────────────────────────────────────────────
// ID cards are ~1.585:1 (ISO/IEC 7810 ID-1). The scan zone honors that ratio so
// the live preview and the framed guide feel like a real "scan your card" target.
const SCAN_ASPECT = 1.585;

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 8 },

  // ── Header ──
  header: {
    backgroundColor: NAVY,
    paddingTop: 14,
    paddingBottom: 22,
    paddingHorizontal: 22,
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 14, marginLeft: -4 },
  backText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  headerEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: AMBER, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 5, lineHeight: 18 },
  stepRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  stepSegment: { flex: 1 },
  stepLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  stepLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  stepLabelActive: { color: '#FFFFFF' },

  // ── Cards ──
  card: { marginHorizontal: 18, marginTop: 16 },

  // ── Instruction box ──
  instrBox: { flexDirection: 'row', gap: 12, borderRadius: 14, padding: 14, marginBottom: 16 },
  instrTextWrap: { flex: 1 },
  instrTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  instrText: { fontSize: 12, lineHeight: 18 },

  // ── Scan hero ──
  scanZone: {
    width: '100%',
    aspectRatio: SCAN_ASPECT,
    borderWidth: 2,
    borderRadius: 18,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scanPlaceholder: { alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  scanIconRing: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  scanLabel: { fontSize: 15, fontWeight: '700' },
  scanHint: { fontSize: 12 },
  idPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  scannedBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  scannedBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  scanBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  scanBusyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Corner guides (idle state)
  corner: { position: 'absolute', width: 26, height: 26, borderColor: NAVY },
  cornerTL: { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },

  // ── Retake ──
  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, alignSelf: 'center', marginTop: 12, paddingVertical: 6, paddingHorizontal: 12,
  },
  retakeBtnText: { fontSize: 13, fontWeight: '700' },

  // ── Warning ──
  warnBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.35)',
  },
  warnIcon: { marginTop: 1, marginRight: 8 },
  warnText: { flex: 1, fontSize: 12.5, color: '#B5730C', lineHeight: 18 },

  // ── Review section ──
  reviewHeader: { marginBottom: 14 },
  reviewTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  reviewSubtitle: { fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  fieldsIdle: { opacity: 0.55 },
  fieldDivider: { height: 1, marginTop: 16, marginBottom: 4 },

  // ── Fields ──
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  autofillTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  autofillTagText: { fontSize: 10.5, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 2 },
  chip: { marginBottom: 2 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', marginBottom: 2 },
  fieldLabelInline: { marginTop: 0 },
  optional: { fontSize: 11.5, fontWeight: '500' },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    marginTop: 6,
    minHeight: 48,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },

  // ── Privacy ──
  privacyRow: { flexDirection: 'row', marginTop: 18 },
  privacyIcon: { marginTop: 1, marginRight: 8 },
  privacyNote: { flex: 1, fontSize: 11.5, lineHeight: 17 },

  // ── CTA ──
  ctaWrap: { marginHorizontal: 18, marginTop: 18 },
  ctaIcon: { marginLeft: 6 },

  spacer: { height: 28 },
});
