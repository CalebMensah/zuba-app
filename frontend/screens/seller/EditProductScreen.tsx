// screens/EditProductScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUpdateProduct } from '../../hooks/useProducts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Colors } from '../../constants/colors';
import { SellerStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = [
  'Electronics',
  'Fashion & Clothing',
  'Home & Garden',
  'Health & Beauty',
  'Sports & Outdoors',
  'Toys & Games',
  'Books & Media',
  'Food & Beverages',
  'Automotive',
  'Jewelry & Accessories',
  'Art & Crafts',
  'Pet Supplies',
  'Office Supplies',
  'Baby & Kids',
  'Other',
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
const COLORS = [
  { name: 'Red', value: 'red' },
  { name: 'Blue', value: 'blue' },
  { name: 'Green', value: 'green' },
  { name: 'Yellow', value: 'yellow' },
  { name: 'Black', value: 'black' },
  { name: 'White', value: 'white' },
  { name: 'Purple', value: 'purple' },
  { name: 'Pink', value: 'pink' },
  { name: 'Orange', value: 'orange' },
  { name: 'Brown', value: 'brown' },
];

type EditProductScreenRouteProp = RouteProp<SellerStackParamList, 'EditProduct'>;
type EditProductScreenNavigationProp = NativeStackNavigationProp<SellerStackParamList>;

interface EditProductScreenProps {
  route: EditProductScreenRouteProp;
  navigation: EditProductScreenNavigationProp;
}

const EditProductScreen: React.FC<EditProductScreenProps> = ({ route, navigation }) => {
  const { productId, initialProduct } = route.params || {};
  
  //TanStack Query mutation hook
  const updateMutation = useUpdateProduct();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [weight, setWeight] = useState('');
  const [sellerNote, setSellerNote] = useState('');
  const [moq, setMoq] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // UI state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name || '');
      setDescription(initialProduct.description || '');
      setPrice(initialProduct.price?.toString() || '');
      setStock(initialProduct.stock?.toString() || '');
      setCategory(initialProduct.category || '');
      setMoq(initialProduct.moq?.toString() || '');
      setIsActive(initialProduct.isActive ?? true);
      setExistingImages(initialProduct.images || []);
      setSelectedSizes(initialProduct.sizes || []);
      setSelectedColors(initialProduct.color || []);
      setTags(initialProduct.tags || []);
    }
  }, [initialProduct]);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      setImages(result.assets);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const toggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size));
    } else {
      setSelectedSizes([...selectedSizes, size]);
    }
  };

  const toggleColor = (color: string) => {
    if (selectedColors.includes(color)) {
      setSelectedColors(selectedColors.filter((c) => c !== color));
    } else {
      setSelectedColors([...selectedColors, color]);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Product name is required');
      return false;
    }

    if (!price || isNaN(parseFloat(price))) {
      Alert.alert('Validation Error', 'Valid price is required');
      return false;
    }

    if (!stock || isNaN(parseInt(stock))) {
      Alert.alert('Validation Error', 'Valid stock quantity is required');
      return false;
    }

    return true;
  };

  // Updated submit handler using TanStack Query mutation
  const handleSubmit = () => {
    if (!validateForm()) return;

    // Prepare update data
    const updateData = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: parseFloat(price),
      stock: parseInt(stock),
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      color: selectedColors.length > 0 ? selectedColors : undefined,
      moq: moq ? parseInt(moq) : undefined,
      isActive,
      images: images.length > 0 ? images : undefined,
    };

    // Use mutation with callbacks
    updateMutation.mutate(
      { productId, updateData },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Product updated successfully', [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]);
        },
        onError: (error) => {
          Alert.alert('Error', error.message || 'Failed to update product. Please try again.');
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Edit Product</Text>
            <TouchableOpacity
              style={[styles.activeToggle, isActive ? styles.activeToggleOn : styles.activeToggleOff]}
              onPress={() => setIsActive(!isActive)}
            >
              <Text style={styles.activeToggleText}>
                {isActive ? 'Active' : 'Inactive'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Existing Images */}
          {existingImages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Current Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.imageGrid}>
                  {existingImages.map((uri, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image source={{ uri }} style={styles.image} />
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.hint}>Upload new images below to replace these</Text>
            </View>
          )}

          {/* New Images */}
          <View style={styles.section}>
            <Text style={styles.label}>
              New Images {images.length > 0 && `(${images.length})`}
            </Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImages}>
              <Ionicons name="camera" size={40} color={Colors.primary} />
              <Text style={styles.imagePickerText}>
                {images.length > 0 ? 'Change Images' : 'Add New Images'}
              </Text>
              <Text style={styles.imagePickerSubtext}>
                {images.length > 0 ? 'Will replace current images' : 'Optional - keep current images'}
              </Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.imageGrid}>
                  {images.map((img, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image source={{ uri: img.uri }} style={styles.image} />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter product name"
              placeholderTextColor={Colors.gray400}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter product description"
              placeholderTextColor={Colors.gray400}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.section, styles.halfWidth]}>
              <Text style={styles.label}>Price (GH₵) *</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={Colors.gray400}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.section, styles.halfWidth]}>
              <Text style={styles.label}>Stock *</Text>
              <TextInput
                style={styles.input}
                value={stock}
                onChangeText={setStock}
                placeholder="0"
                placeholderTextColor={Colors.gray400}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.categoryButton}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={category ? styles.categoryButtonTextSelected : styles.categoryButtonText}>
                {category || 'Select Category'}
              </Text>
              <Ionicons
                name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.gray600}
              />
            </TouchableOpacity>

            {showCategoryPicker && (
              <ScrollView 
                style={styles.categoryList}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryItem,
                      category === cat && styles.categoryItemSelected,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryItemText,
                        category === cat && styles.categoryItemTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                    {category === cat && (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Available Sizes (Optional)</Text>
            <View style={styles.chipsContainer}>
              {SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.chip,
                    selectedSizes.includes(size) && styles.chipSelected,
                  ]}
                  onPress={() => toggleSize(size)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedSizes.includes(size) && styles.chipTextSelected,
                    ]}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Available Colors (Optional)</Text>
            <View style={styles.chipsContainer}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  style={[
                    styles.chip,
                    selectedColors.includes(color.value) && styles.chipSelected,
                  ]}
                  onPress={() => toggleColor(color.value)}
                >
                  <View style={[styles.colorDot, { backgroundColor: color.value }]} />
                  <Text
                    style={[
                      styles.chipText,
                      selectedColors.includes(color.value) && styles.chipTextSelected,
                    ]}
                  >
                    {color.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Tags (Optional)</Text>
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag"
                placeholderTextColor={Colors.gray400}
                onSubmitEditing={addTag}
              />
              <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
                <Ionicons name="add" size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                    <TouchableOpacity onPress={() => removeTag(tag)}>
                      <Ionicons name="close" size={16} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.row}>

            <View style={[styles.section, styles.halfWidth]}>
              <Text style={styles.label}>MOQ</Text>
              <TextInput
                style={styles.input}
                value={moq}
                onChangeText={setMoq}
                placeholder="1"
                placeholderTextColor={Colors.gray400}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, updateMutation.isPending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <LoadingSpinner size={20} color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                <Text style={styles.submitBtnText}>Update Product</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  activeToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeToggleOn: {
    backgroundColor: Colors.success,
  },
  activeToggleOff: {
    backgroundColor: Colors.gray400,
  },
  activeToggleText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  imagePicker: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  imagePickerSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  imageGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: Colors.gray200,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  categoryButtonText: {
    fontSize: 15,
    color: Colors.gray400,
  },
  categoryButtonTextSelected: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  categoryList: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
    maxHeight: 250,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryItemSelected: {
    backgroundColor: Colors.gray50,
  },
  categoryItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  categoryItemTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.white,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  tagInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  addTagButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '500',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.gray400,
    shadowOpacity: 0.1,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default EditProductScreen;