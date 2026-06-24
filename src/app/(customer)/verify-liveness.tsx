import React, { useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAppDialog } from '@/hooks';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useThemeMode } from '@/core/theme';
import { api, extractApiError } from '@/core/api';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

type LivenessStep = 'straight' | 'left' | 'right' | 'down' | 'selfie' | 'done';

const STEP_INSTRUCTIONS: Record<LivenessStep, string> = {
  straight: 'Look straight at the camera',
  left:     'Slowly turn your head LEFT',
  right:    'Slowly turn your head RIGHT',
  down:     'Tilt your head DOWN slightly',
  selfie:   'Look straight — hold still — taking selfie!',
  done:     'All done!',
};

const STEP_ORDER: LivenessStep[] = ['straight', 'left', 'right', 'down', 'selfie', 'done'];

export default function VerifyLivenessScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [currentStep, setCurrentStep] = useState<LivenessStep>('straight');
  const [completedSteps, setCompletedSteps] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg: string        = isDark ? '#0F1117' : '#F0F4F8';
  const textPrimary: string   = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : '#64748B';
  const progressBg: string    = isDark ? '#374151' : '#E5E7EB';
  const stepDotDefault: string = isDark ? '#374151' : '#E5E7EB';
  const instrBoxBg: string    = isDark ? '#1E2435' : '#FFFFFF';
  const instrBoxBorder: string = isDark ? 'rgba(255,255,255,0.07)' : '#E5E7EB';
  const permBoxText: string   = textSecondary;
  const doneText: string      = textPrimary;

  const advanceStep = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = STEP_ORDER.indexOf(prev);
      const next = STEP_ORDER[idx + 1] ?? 'done';
      if (next === 'done') {
        handleCaptureAndSubmit();
      }
      setCompletedSteps(idx + 1);
      return next;
    });
  }, []);

  const handleStepConfirm = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    advanceStep();
  };

  const handleCaptureAndSubmit = async () => {
    if (!customer) return;
    setIsSubmitting(true);
    try {
      const sessionToken = await SecureStore.getItemAsync('suki_customer_session_token').catch(() => null);
      // In production: capture a selfie frame via cameraRef.current?.takePictureAsync()
      // and upload it along with the liveness result. For MVP, we trust the client sequence.
      // POST /customers/verify/liveness — backend stores the result and moves the
      // customer to PENDING (awaiting merchant review).
      await api.post('/customers/verify/liveness', {
        customerId: customer.id,
        sessionToken,
        livenessScore: 1,
      });
      dialog.show({
        variant: 'success',
        title: 'Verification Submitted!',
        message: 'Your identity verification is now pending review by your merchant.',
        confirmText: 'OK',
        onConfirm: () => router.replace('/(customer)/profile'),
      });
    } catch (err) {
      const { code, detail } = extractApiError(err);
      dialog.show({ variant: 'error', title: 'Error', message: detail ?? code ?? 'Please try again.' });
      setIsSubmitting(false);
      setCurrentStep('straight');
      setCompletedSteps(0);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = completedSteps / (STEP_ORDER.length - 1);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.brandStripe}>
          <View style={[styles.stripe, { backgroundColor: NAVY }]} />
          <View style={[styles.stripe, { backgroundColor: AMBER }]} />
          <View style={[styles.stripe, { backgroundColor: GREEN }]} />
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Verification — Step 2 of 2</Text>
      </View>

      <View style={styles.content}>
        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: progressBg }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {!permission ? (
          <ActivityIndicator color={NAVY} size="large" style={{ marginTop: 40 }} />
        ) : !permission.granted ? (
          <View style={styles.permBox}>
            <Text style={[styles.permText, { color: permBoxText }]}>
              Camera access is required for face verification.
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        ) : currentStep === 'done' || isSubmitting ? (
          <View style={styles.doneBox}>
            <ActivityIndicator color={GREEN} size="large" />
            <Text style={[styles.doneTextStyle, { color: doneText }]}>
              Submitting your verification...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.cameraFrame}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing="front"
              />
              {/* Oval face guide */}
              <View style={styles.faceOval} />
            </View>

            {/* Step indicator dots */}
            <View style={styles.stepDots}>
              {STEP_ORDER.slice(0, -1).map((step, i) => (
                <View
                  key={step}
                  style={[
                    styles.stepDot,
                    { backgroundColor: stepDotDefault },
                    i < stepIndex && { backgroundColor: GREEN },
                    i === stepIndex && styles.stepDotActive,
                  ]}
                />
              ))}
            </View>

            <View style={[styles.instructionBox, { backgroundColor: instrBoxBg, borderColor: instrBoxBorder }]}>
              <Text style={[styles.stepNum, { color: textSecondary }]}>
                Step {stepIndex + 1} of {STEP_ORDER.length - 1}
              </Text>
              <Text style={[styles.instructionText, { color: textPrimary }]}>
                {STEP_INSTRUCTIONS[currentStep]}
              </Text>
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleStepConfirm} activeOpacity={0.85}>
              <Text style={styles.confirmBtnText}>
                {currentStep === 'selfie' ? 'Take Selfie' : 'Done →'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.hintText, { color: textSecondary }]}>
              Position your face inside the oval, then press Done when you have completed the movement.
            </Text>
          </>
        )}
      </View>
      {dialog.Dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { backgroundColor: NAVY, paddingTop: 16, paddingBottom: 20, paddingHorizontal: 20 },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20 },
  progressBar: { width: '100%', height: 6, borderRadius: 3, marginBottom: 24 },
  progressFill: { height: 6, backgroundColor: GREEN, borderRadius: 3 },
  cameraFrame: {
    width: 240,
    height: 300,
    borderRadius: 120,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: AMBER,
    marginBottom: 20,
    position: 'relative',
  },
  faceOval: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 120,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  stepDots: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepDotActive: { backgroundColor: AMBER, transform: [{ scale: 1.3 }] },
  instructionBox: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  stepNum: { fontSize: 11, marginBottom: 4 },
  instructionText: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  confirmBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
    marginBottom: 12,
  },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  hintText: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  permBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  permText: { fontSize: 13, textAlign: 'center' },
  permBtn: { backgroundColor: NAVY, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  permBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  doneTextStyle: { fontSize: 16, fontWeight: '700' },
});
