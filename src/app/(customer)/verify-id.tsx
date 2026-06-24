import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAppDialog } from '@/hooks';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useThemeMode } from '@/core/theme';
import { api, extractApiError } from '@/core/api';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

const PCN_REGEX = /\b\d{4}-\d{7}-\d{5}\b/;
const BIRTHDATE_REGEX = /\b\d{2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}\b/i;

export default function VerifyIdScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const [idImageUri, setIdImageUri] = useState<string | null>(null);
  const [ocrFullName, setOcrFullName] = useState('');
  const [ocrBirthDate, setOcrBirthDate] = useState('');
  const [ocrIdNumber, setOcrIdNumber] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [ocrRawText, setOcrRawText] = useState('');

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg: string        = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg: string        = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder: string    = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : '#64748B';
  const inputBg: string       = isDark ? '#1E2435' : '#FAFBFD';
  const inputBorder: string   = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string     = isDark ? '#F1F5F9' : '#111111';
  const placeholderColor: string = isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8';
  const cameraBorder: string  = isDark ? 'rgba(255,255,255,0.15)' : '#DDE3EE';
  const instrBoxBg: string    = isDark ? 'rgba(79,158,255,0.10)' : '#EFF6FF';
  const instrTitleColor: string = isDark ? '#4F9EFF' : NAVY;
  const labelColor: string    = isDark ? '#4F9EFF' : NAVY;
  const cameraBtnText: string = isDark ? '#4F9EFF' : NAVY;
  const retakeBtnText: string = isDark ? '#4F9EFF' : NAVY;

  const handlePickId = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setIdImageUri(asset.uri);

    // Attempt on-device OCR if available
    try {
      // Dynamic import so the app doesn't crash if @react-native-ml-kit/text-recognition is not installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const TextRecognition = require('@react-native-ml-kit/text-recognition').default as {
        recognize: (uri: string) => Promise<{ text: string }>;
      };
      const result2 = await TextRecognition.recognize(asset.uri);
      const raw = result2.text;
      setOcrRawText(raw);
      const pcn = PCN_REGEX.exec(raw);
      if (pcn?.[0]) setOcrIdNumber(pcn[0]);
      const bd = BIRTHDATE_REGEX.exec(raw);
      if (bd?.[0]) setOcrBirthDate(bd[0]);
    } catch {
      // OCR library not installed or failed — user will fill manually
    }
  };

  const handleSubmit = async () => {
    if (!customer) return;
    if (!idImageUri) {
      dialog.show({ variant: 'error', title: 'No photo', message: 'Please take a photo of your ID first.' });
      return;
    }
    if (!ocrFullName.trim()) {
      dialog.show({ variant: 'error', title: 'Required', message: 'Please enter your full name as shown on the ID.' });
      return;
    }
    setIsUploading(true);
    try {
      const sessionToken = await SecureStore.getItemAsync('suki_customer_session_token').catch(() => null);
      // POST /customers/verify/upload-id — multipart upload to the backend.
      const formData = new FormData();
      formData.append('file', { uri: idImageUri, name: 'id_front.jpg', type: 'image/jpeg' } as unknown as Blob);
      formData.append('customerId', customer.id);
      formData.append('documentType', 'NATIONAL_ID');
      if (sessionToken) formData.append('sessionToken', sessionToken);
      formData.append('ocrFullName', ocrFullName.trim());
      if (ocrBirthDate.trim()) formData.append('ocrBirthDate', ocrBirthDate.trim());
      if (ocrIdNumber.trim()) formData.append('ocrIdNumber', ocrIdNumber.trim());
      if (ocrRawText) formData.append('ocrRawText', ocrRawText);

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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brandStripe}>
            <View style={[styles.stripe, { backgroundColor: NAVY }]} />
            <View style={[styles.stripe, { backgroundColor: AMBER }]} />
            <View style={[styles.stripe, { backgroundColor: GREEN }]} />
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: 'rgba(255,255,255,0.80)' }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload ID — Step 1 of 2</Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.cardBody}>
            <View style={[styles.instrBox, { backgroundColor: instrBoxBg }]}>
              <Text style={[styles.instrTitle, { color: instrTitleColor }]}>Philippine Government ID</Text>
              <Text style={[styles.instrText, { color: textSecondary }]}>
                Take a clear photo of your government-issued ID (PhilSys, Driver's License, SSS, Passport, PhilHealth, etc.).
                Make sure all text is readable.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.cameraBtn, { borderColor: cameraBorder }]}
              onPress={handlePickId}
              activeOpacity={0.85}
            >
              {idImageUri ? (
                <Image source={{ uri: idImageUri }} style={styles.idPreview} />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Text style={styles.cameraIcon}>📷</Text>
                  <Text style={[styles.cameraBtnTextStyle, { color: cameraBtnText }]}>Take Photo of ID</Text>
                </View>
              )}
            </TouchableOpacity>

            {idImageUri && (
              <TouchableOpacity style={styles.retakeBtn} onPress={handlePickId}>
                <Text style={[styles.retakeBtnTextStyle, { color: retakeBtnText }]}>Retake Photo</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.fieldLabel, { color: labelColor }]}>Full Name (as on ID) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
              value={ocrFullName}
              onChangeText={setOcrFullName}
              placeholder="Dela Cruz, Juan P."
              autoCapitalize="words"
              placeholderTextColor={placeholderColor}
            />

            <Text style={[styles.fieldLabel, { color: labelColor }]}>Birthdate (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
              value={ocrBirthDate}
              onChangeText={setOcrBirthDate}
              placeholder="e.g. 01 JAN 1990"
              placeholderTextColor={placeholderColor}
            />

            <Text style={[styles.fieldLabel, { color: labelColor }]}>ID Number (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
              value={ocrIdNumber}
              onChangeText={setOcrIdNumber}
              placeholder="PCN / License No. / SSS No."
              placeholderTextColor={placeholderColor}
            />

            <TouchableOpacity
              style={[styles.submitBtn, (isUploading || !idImageUri) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isUploading || !idImageUri}
              activeOpacity={0.85}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Next: Face Verification →</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
      {dialog.Dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: {
    backgroundColor: NAVY,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardBody: { padding: 20 },
  instrBox: { borderRadius: 10, padding: 14, marginBottom: 16 },
  instrTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  instrText: { fontSize: 12, lineHeight: 18 },
  cameraBtn: {
    borderWidth: 2,
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 12,
  },
  cameraPlaceholder: { padding: 32, alignItems: 'center', gap: 8 },
  cameraIcon: { fontSize: 36 },
  cameraBtnTextStyle: { fontSize: 13, fontWeight: '600' },
  idPreview: { width: '100%', height: 200, resizeMode: 'contain' },
  retakeBtn: { marginBottom: 16 },
  retakeBtnTextStyle: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  submitBtn: { marginTop: 16, backgroundColor: NAVY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  spacer: { height: 32 },
});
