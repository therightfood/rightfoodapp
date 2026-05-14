import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Camera,
  Settings,
  X,
  Images,
  Zap,
  ZapOff,
  CameraOff,
} from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { COLORS } from '@/constants/Colors';
import { authClient } from '@/lib/auth';

const BACKEND_URL = 'https://3pqctptn272ematfhedrjv4we23tdyxd.app.specular.dev';

type ScreenState = 'empty' | 'camera' | 'analyzing';
type FlashState = 'off' | 'on';

export default function ScanScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('empty');
  const [flash, setFlash] = useState<FlashState>('off');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [showCameraPermDenied, setShowCameraPermDenied] = useState(false);
  const [showLibraryPermDenied, setShowLibraryPermDenied] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Reset to empty state when screen regains focus (e.g. returning from scan-result)
  useFocusEffect(
    useCallback(() => {
      console.log('[Scan] Screen focused — resetting to empty state');
      setScreenState('empty');
      setCapturedUri(null);
    }, [])
  );

  const handleSettings = () => {
    console.log('[Scan] Settings button pressed');
  };

  const handleTakePhoto = async () => {
    console.log('[Scan] "Take a photo" button pressed');
    if (!cameraPermission?.granted) {
      console.log('[Scan] Camera permission not granted — requesting');
      const result = await requestCameraPermission();
      if (!result.granted) {
        console.log('[Scan] Camera permission denied (canAskAgain:', result.canAskAgain, ')');
        setShowCameraPermDenied(true);
        return;
      }
    }
    console.log('[Scan] Camera permission granted — switching to camera state');
    setScreenState('camera');
  };

  const analyzePhoto = async (uri: string) => {
    setCapturedUri(uri);
    setScreenState('analyzing');

    try {
      console.log('[Scan] Getting auth token');
      const session = await authClient.getSession();
      const token = session?.data?.session?.token;
      if (!token) throw new Error('No auth token');

      // Step 1: Upload the image
      console.log('[Scan] Uploading image to /api/scan/upload');
      const formData = new FormData();
      formData.append('image', {
        uri,
        type: 'image/jpeg',
        name: 'meal.jpg',
      } as any);

      const uploadRes = await fetch(`${BACKEND_URL}/api/scan/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
      }
      const { image_url } = await uploadRes.json();
      console.log('[Scan] Upload succeeded, image_url:', image_url);

      // Step 2: Analyze
      console.log('[Scan] Sending image_url to /api/scan/analyze');
      const analyzeRes = await fetch(`${BACKEND_URL}/api/scan/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url }),
      });

      if (analyzeRes.status === 422) {
        const errData = await analyzeRes.json();
        console.log('[Scan] Low confidence result:', errData);
        router.push({
          pathname: '/scan-result',
          params: {
            photoUri: uri,
            analysisId: errData.id || '',
            error: 'low_confidence',
          },
        });
        return;
      }

      if (!analyzeRes.ok) {
        const errText = await analyzeRes.text();
        throw new Error(`Analysis failed (${analyzeRes.status}): ${errText}`);
      }

      const analysis = await analyzeRes.json();
      console.log('[Scan] Analysis succeeded:', analysis.id, analysis.dish_name);

      router.push({
        pathname: '/scan-result',
        params: {
          photoUri: uri,
          analysisId: analysis.id,
          dishName: analysis.dish_name,
          portionPct: String(analysis.portion_suggestion_pct),
          totalCalories: String(analysis.total_calories),
          proteinG: String(analysis.protein_g),
          carbsG: String(analysis.carbs_g),
          fatG: String(analysis.fat_g),
          fiberG: String(analysis.fiber_g),
          confidence: String(analysis.confidence),
          foodsIdentified: JSON.stringify(analysis.foods_identified),
          medication: analysis.medication || '',
          doseMg: String(analysis.dose_mg || ''),
        },
      });
    } catch (err) {
      console.error('[Scan] Analysis error:', err);
      router.push({
        pathname: '/scan-result',
        params: {
          photoUri: uri,
          error: 'failed',
        },
      });
    }
  };

  const handleChooseFromLibrary = async () => {
    console.log('[Scan] "Choose from library" button pressed');
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libPerm.granted) {
      console.log('[Scan] Library permission denied (canAskAgain:', libPerm.canAskAgain, ')');
      setShowLibraryPermDenied(true);
      return;
    }
    console.log('[Scan] Library permission granted — launching image picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      console.log('[Scan] Image selected from library:', uri);
      analyzePhoto(uri);
    } else {
      console.log('[Scan] Image picker cancelled');
    }
  };

  const handleShutter = async () => {
    console.log('[Scan] Shutter button pressed');
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) {
        console.log('[Scan] takePictureAsync returned null');
        return;
      }
      console.log('[Scan] Photo captured:', photo.uri);
      analyzePhoto(photo.uri);
    } catch (err) {
      console.log('[Scan] Error taking picture:', err);
    }
  };

  const handleFlashToggle = () => {
    const next: FlashState = flash === 'off' ? 'on' : 'off';
    console.log('[Scan] Flash toggled to:', next);
    setFlash(next);
  };

  const handleExitCamera = () => {
    console.log('[Scan] Exit camera button pressed');
    setScreenState('empty');
  };

  const handleOpenSettings = () => {
    console.log('[Scan] "Open Settings" pressed');
    Linking.openSettings();
  };

  const handleDismissCameraDenied = () => {
    console.log('[Scan] Camera permission denied card dismissed');
    setShowCameraPermDenied(false);
  };

  const handleDismissLibraryDenied = () => {
    console.log('[Scan] Library permission denied card dismissed');
    setShowLibraryPermDenied(false);
  };

  // ─── Camera state (edge-to-edge) ───────────────────────────────────────────
  if (screenState === 'camera') {
    const topBarPaddingTop = insets.top + 12;
    const bottomBarPaddingBottom = insets.bottom + 20;
    const flashIcon =
      flash === 'off' ? (
        <Zap size={26} color="white" strokeWidth={2} />
      ) : (
        <ZapOff size={26} color="white" strokeWidth={2} />
      );

    return (
      <View style={styles.fullScreen}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          flash={flash}
        />

        {/* Top overlay */}
        <View style={[styles.cameraTopBar, { paddingTop: topBarPaddingTop }]}>
          <Text style={styles.cameraHintText}>Point at your meal</Text>
          <Pressable style={styles.cameraCloseButton} onPress={handleExitCamera}>
            <X size={22} color="white" strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Bottom controls */}
        <View style={[styles.cameraBottomBar, { paddingBottom: bottomBarPaddingBottom }]}>
          {/* Library button */}
          <Pressable style={styles.cameraRoundButton} onPress={handleChooseFromLibrary}>
            <Images size={26} color="white" strokeWidth={2} />
          </Pressable>

          {/* Shutter */}
          <Pressable style={styles.shutterOuter} onPress={handleShutter}>
            <View style={styles.shutterInner} />
          </Pressable>

          {/* Flash toggle */}
          <Pressable style={styles.cameraRoundButton} onPress={handleFlashToggle}>
            {flashIcon}
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Analyzing state ────────────────────────────────────────────────────────
  if (screenState === 'analyzing') {
    const capturedSource = capturedUri ? { uri: capturedUri } : null;
    return (
      <View style={styles.fullScreen}>
        {capturedSource ? (
          <Image
            source={capturedSource}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator size="large" color="#4A7C59" />
          <Text style={styles.analyzingText}>Analyzing your meal...</Text>
        </View>
      </View>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Right Food</Text>
        <AnimatedPressable style={styles.settingsButton} onPress={handleSettings}>
          <Settings size={22} color={COLORS.textSecondary} strokeWidth={2} />
        </AnimatedPressable>
      </View>

      {/* Center content */}
      <View style={styles.centerContent}>
        <View style={styles.iconCircle}>
          <Camera size={44} color={COLORS.primary} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Scan your meal</Text>
        <Text style={styles.description}>
          Take a photo and we'll tell you exactly how much to eat
        </Text>

        <AnimatedPressable style={styles.primaryButton} onPress={handleTakePhoto}>
          <Text style={styles.primaryButtonText}>Take a photo</Text>
        </AnimatedPressable>

        <AnimatedPressable style={styles.secondaryButton} onPress={handleChooseFromLibrary}>
          <Text style={styles.secondaryButtonText}>Choose from library</Text>
        </AnimatedPressable>
      </View>

      {/* Camera permission denied card */}
      {showCameraPermDenied ? (
        <View style={styles.permOverlay}>
          <View style={styles.permCard}>
            <View style={styles.permIconCircle}>
              <CameraOff size={40} color={COLORS.textSecondary} strokeWidth={1.5} />
            </View>
            <Text style={styles.permTitle}>Camera access needed</Text>
            <Text style={styles.permBody}>
              Right Food needs camera access to photograph your meals. You can enable this in your
              phone's Settings.
            </Text>
            <AnimatedPressable style={styles.permButton} onPress={handleOpenSettings}>
              <Text style={styles.permButtonText}>Open Settings</Text>
            </AnimatedPressable>
            <Pressable onPress={handleDismissCameraDenied}>
              <Text style={styles.permDismiss}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Library permission denied card */}
      {showLibraryPermDenied ? (
        <View style={styles.permOverlay}>
          <View style={styles.permCard}>
            <View style={styles.permIconCircle}>
              <Images size={40} color={COLORS.textSecondary} strokeWidth={1.5} />
            </View>
            <Text style={styles.permTitle}>Photo library access needed</Text>
            <Text style={styles.permBody}>
              Right Food needs photo library access to select meal photos. You can enable this in
              your phone's Settings.
            </Text>
            <AnimatedPressable style={styles.permButton} onPress={handleOpenSettings}>
              <Text style={styles.permButtonText}>Open Settings</Text>
            </AnimatedPressable>
            <Pressable onPress={handleDismissLibraryDenied}>
              <Text style={styles.permDismiss}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Shared
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Empty state
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSpacer: { width: 44 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.2,
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    maxWidth: 260,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Camera state
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraHintText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
  },
  cameraCloseButton: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingTop: 20,
    paddingHorizontal: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraRoundButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.15)',
  },

  // Analyzing state
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    marginTop: 16,
  },

  // Permission denied
  permOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  permIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  permButton: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  permButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permDismiss: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});
