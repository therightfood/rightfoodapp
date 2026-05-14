import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Camera,
  Image as ImageIcon,
  UtensilsCrossed,
  AlertCircle,
  ChevronDown,
  Clock,
  Zap,
  Flame,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { authClient } from '@/lib/auth';

interface Recipe {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  estimated_calories_per_serving: number;
  protein_g_per_serving: number;
  prep_time_minutes: number;
}

// ─── Pulsing Dots ─────────────────────────────────────────────────────────────

function PulsingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );

    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 200);
    const a3 = makePulse(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  if (Platform.OS === 'web') {
    return (
      <View style={pulseStyles.row}>
        <View style={pulseStyles.dot} />
        <View style={pulseStyles.dot} />
        <View style={pulseStyles.dot} />
      </View>
    );
  }

  return (
    <View style={pulseStyles.row}>
      <Animated.View style={[pulseStyles.dot, { opacity: dot1 }]} />
      <Animated.View style={[pulseStyles.dot, { opacity: dot2 }]} />
      <Animated.View style={[pulseStyles.dot, { opacity: dot3 }]} />
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A7C59' },
});

// ─── Single Pulsing Dot ───────────────────────────────────────────────────────

function SinglePulsingDot() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  if (Platform.OS === 'web') {
    return <View style={singleDotStyles.dot} />;
  }

  return <Animated.View style={[singleDotStyles.dot, { opacity }]} />;
}

const singleDotStyles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4A7C59' },
});

// ─── RecipeCard ───────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onScanMeal: () => void;
}

function RecipeCard({ recipe, expanded, onToggle, onScanMeal }: RecipeCardProps) {
  const calories = recipe.estimated_calories_per_serving;
  const protein = recipe.protein_g_per_serving;
  const prepTime = recipe.prep_time_minutes;

  const caloriesText = String(calories) + ' kcal';
  const proteinText = String(protein) + 'g protein';
  const prepText = String(prepTime) + ' min';

  const chevronRotation = expanded ? '180deg' : '0deg';

  return (
    <View style={cardStyles.card}>
      {/* Header */}
      <View style={cardStyles.header}>
        <Text style={cardStyles.name}>{recipe.name}</Text>
        <Text style={cardStyles.description}>{recipe.description}</Text>

        <View style={cardStyles.statsRow}>
          <View style={cardStyles.statPill}>
            <Flame size={12} color={COLORS.accent} />
            <Text style={cardStyles.statText}>{caloriesText}</Text>
          </View>
          <View style={cardStyles.statPill}>
            <Zap size={12} color={COLORS.primary} />
            <Text style={cardStyles.statText}>{proteinText}</Text>
          </View>
          <View style={cardStyles.statPill}>
            <Clock size={12} color="#7A6A5A" />
            <Text style={cardStyles.statText}>{prepText}</Text>
          </View>
        </View>
      </View>

      {/* Toggle row */}
      <AnimatedPressable onPress={onToggle} style={cardStyles.toggleRow}>
        <Text style={cardStyles.toggleText}>
          {expanded ? 'Hide details' : 'Show ingredients & steps'}
        </Text>
        <ChevronDown
          size={16}
          color="#4A7C59"
          style={{ transform: [{ rotate: chevronRotation }] }}
        />
      </AnimatedPressable>

      {/* Expanded section */}
      {expanded && (
        <View style={cardStyles.expandedSection}>
          <Text style={cardStyles.sectionLabel}>INGREDIENTS</Text>
          {recipe.ingredients.map((ingredient, i) => (
            <View key={i} style={cardStyles.ingredientRow}>
              <View style={cardStyles.dot} />
              <Text style={cardStyles.ingredientText}>{ingredient}</Text>
            </View>
          ))}

          <Text style={[cardStyles.sectionLabel, { marginTop: 16 }]}>INSTRUCTIONS</Text>
          {recipe.instructions.map((step, i) => {
            const stepNum = String(i + 1);
            return (
              <View key={i} style={cardStyles.stepRow}>
                <View style={cardStyles.stepNumCircle}>
                  <Text style={cardStyles.stepNumber}>{stepNum}</Text>
                </View>
                <Text style={cardStyles.stepText}>{step}</Text>
              </View>
            );
          })}

          <AnimatedPressable onPress={onScanMeal} style={cardStyles.scanMealButton}>
            <Camera size={14} color="#4A7C59" />
            <Text style={cardStyles.scanMealText}>Scan this meal</Text>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    padding: 16,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  description: {
    fontSize: 14,
    color: '#7A6A5A',
    lineHeight: 21,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3EF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statText: {
    fontSize: 12,
    color: '#7A6A5A',
  },
  toggleRow: {
    borderTopWidth: 1,
    borderTopColor: '#E8E6E0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: '#4A7C59',
    fontWeight: '500',
  },
  expandedSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E6E0',
    backgroundColor: '#FAFAF8',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A6A5A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4A7C59',
    marginRight: 8,
  },
  ingredientText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  stepNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(74, 124, 89, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A7C59',
    textAlign: 'center',
  },
  stepText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    flex: 1,
  },
  scanMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    backgroundColor: 'rgba(74, 124, 89, 0.10)',
    borderRadius: 10,
    marginTop: 16,
  },
  scanMealText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A7C59',
  },
});

// ─── RecipesScreen ────────────────────────────────────────────────────────────

export default function RecipesScreen() {
  const router = useRouter();

  const [ingredientsText, setIngredientsText] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractingIngredients, setExtractingIngredients] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const extractIngredients = async (uri: string) => {
    console.log('[Recipes] extractIngredients called with uri:', uri);
    setExtractingIngredients(true);
    setError(null);
    try {
      const session = await authClient.getSession();
      const token = session?.data?.session?.token;

      const formData = new FormData();
      formData.append('image', { uri, type: 'image/jpeg', name: 'fridge.jpg' } as any);

      console.log('[Recipes] POST /api/recipes/extract-ingredients');
      const res = await fetch(
        'https://kpfycbf2n3wy2nx3my6e5m8dypgb5z5y.app.specular.dev/api/recipes/extract-ingredients',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Recipes] extract-ingredients error:', res.status, errText);
        throw new Error('Could not identify ingredients');
      }
      const data = await res.json();
      console.log('[Recipes] extract-ingredients response:', data);
      const joined = (data.ingredients as string[]).join(', ');
      setIngredientsText(joined);
    } catch (err: any) {
      console.error('[Recipes] extractIngredients error:', err);
      setError('Could not identify ingredients from photo. Please type them manually.');
    } finally {
      setExtractingIngredients(false);
    }
  };

  const generateRecipes = async () => {
    if (!ingredientsText.trim()) return;
    console.log('[Recipes] generateRecipes called with ingredients:', ingredientsText.trim());
    setLoading(true);
    setError(null);
    setRecipes([]);
    setExpandedIndex(null);

    try {
      const session = await authClient.getSession();
      const token = session?.data?.session?.token;

      console.log('[Recipes] POST /api/recipes/generate');
      const res = await fetch(
        'https://kpfycbf2n3wy2nx3my6e5m8dypgb5z5y.app.specular.dev/api/recipes/generate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ingredients: ingredientsText.trim() }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn('[Recipes] generate error:', res.status, errData);
        throw new Error((errData as any).error || 'Could not generate recipes');
      }

      const data = await res.json();
      console.log('[Recipes] generate response: received', (data.recipes || []).length, 'recipes');
      setRecipes(data.recipes || []);
    } catch (err: any) {
      console.error('[Recipes] generateRecipes error:', err);
      setError(err.message || 'Could not generate recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanFridge = async () => {
    console.log('[Recipes] Scan fridge button pressed');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Recipes] Camera permission denied');
      setError('Camera permission is required to scan your fridge.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      console.log('[Recipes] Camera image captured:', result.assets[0].uri);
      extractIngredients(result.assets[0].uri);
    }
  };

  const handleFromLibrary = async () => {
    console.log('[Recipes] From library button pressed');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Recipes] Media library permission denied');
      setError('Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      console.log('[Recipes] Library image selected:', result.assets[0].uri);
      extractIngredients(result.assets[0].uri);
    }
  };

  const handleScanMeal = (dishName: string) => {
    console.log('[Recipes] Scan this meal pressed for:', dishName);
    router.push('/(tabs)/(scan)');
  };

  const handleToggleRecipe = (index: number) => {
    console.log('[Recipes] Toggle recipe card index:', index);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const isGetRecipesDisabled = ingredientsText.trim() === '' || loading;
  const getRecipesOpacity = isGetRecipesDisabled ? 0.4 : 1;
  const inputBorderColor = inputFocused ? '#4A7C59' : '#E8E6E0';
  const inputBorderWidth = inputFocused ? 1.5 : 1;

  const showEmptyState = recipes.length === 0 && !loading && !error;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recipes</Text>
          <Text style={styles.headerSubtitle}>GLP-1 friendly recipes for your ingredients</Text>
        </View>

        {/* Input card */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>YOUR INGREDIENTS</Text>
          <TextInput
            style={[styles.textInput, { borderColor: inputBorderColor, borderWidth: inputBorderWidth }]}
            multiline
            placeholder="e.g. chicken breast, broccoli, olive oil, garlic..."
            placeholderTextColor={COLORS.textTertiary}
            value={ingredientsText}
            onChangeText={setIngredientsText}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />

          {/* Photo buttons */}
          <View style={styles.photoButtonRow}>
            <AnimatedPressable onPress={handleScanFridge} style={styles.photoButton}>
              <Camera size={16} color={COLORS.textSecondary} />
              <Text style={styles.photoButtonText}>Scan fridge</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={handleFromLibrary} style={styles.photoButton}>
              <ImageIcon size={16} color={COLORS.textSecondary} />
              <Text style={styles.photoButtonText}>From library</Text>
            </AnimatedPressable>
          </View>

          {/* Extracting indicator */}
          {extractingIngredients && (
            <View style={styles.extractingRow}>
              <SinglePulsingDot />
              <Text style={styles.extractingText}>Identifying ingredients...</Text>
            </View>
          )}

          {/* Get recipes button */}
          <AnimatedPressable
            onPress={generateRecipes}
            disabled={isGetRecipesDisabled}
            style={[styles.getRecipesButton, { opacity: getRecipesOpacity }]}
          >
            <Text style={styles.getRecipesText}>Get recipes</Text>
          </AnimatedPressable>
        </View>

        {/* Error state */}
        {error !== null && (
          <View style={styles.errorContainer}>
            <AlertCircle size={18} color="#C0392B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Loading state */}
        {loading && (
          <View style={styles.loadingContainer}>
            <PulsingDots />
            <Text style={styles.loadingText}>Finding recipes for your ingredients...</Text>
          </View>
        )}

        {/* Empty state */}
        {showEmptyState && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <UtensilsCrossed size={40} color="#4A7C59" strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>What's in your kitchen?</Text>
            <Text style={styles.emptySubtitle}>
              Enter your ingredients above and we'll suggest GLP-1 friendly recipes.
            </Text>
          </View>
        )}

        {/* Recipe cards */}
        {recipes.length > 0 && (
          <View style={styles.recipesContainer}>
            {recipes.map((recipe, index) => (
              <RecipeCard
                key={index}
                recipe={recipe}
                index={index}
                expanded={expandedIndex === index}
                onToggle={() => handleToggleRecipe(index)}
                onScanMeal={() => handleScanMeal(recipe.name)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  inputCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    padding: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A6A5A',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textInput: {
    minHeight: 88,
    backgroundColor: '#F5F3EF',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  photoButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#F5F3EF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  extractingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  extractingText: {
    fontSize: 13,
    color: '#7A6A5A',
  },
  getRecipesButton: {
    marginTop: 16,
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getRecipesText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(192, 57, 43, 0.08)',
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#C0392B',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#7A6A5A',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 124, 89, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#7A6A5A',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  recipesContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
});
