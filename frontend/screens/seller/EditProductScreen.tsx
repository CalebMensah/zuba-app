// screens/EditProductScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProduct } from '../../hooks/useProducts';
import { Colors } from '../../constants/colors';
import { SellerStackParamList } from '../../types/navigation';

type EditProductScreenRouteProp = RouteProp<SellerStackParamList, 'EditProduct'>;
type EditProductScreenNavigationProp = NativeStackNavigationProp<SellerStackParamList>;

interface EditProductScreenProps {
  route: EditProductScreenRouteProp;
  navigation: EditProductScreenNavigationProp;
}

const EditProductScreen: React.FC<EditProductScreenProps> = ({ route, navigation }) => {
  const { productId, initialProduct } = route.params || {};
  const { updateProduct, loading, error, clearError } = useProduct();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [sizes, setSizes] = useState('');
  const [colors, setColors] = useState('');
  const [weight, setWeight] = useState('');
  const [sellerNote, setSellerNote] = useState('');
  const [moq, setMoq] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name || '');
      setDescription(initialProduct.description || '');
      setPrice(initialProduct.price?.toString() || '');
      setStock(initialProduct.stock?.toString() || '');
      setCategory(initialProduct.category || '');
      setTags(initialProduct.tags?.join(', ') || '');
      setSizes(initialProduct.sizes?.join(', ') || '');
      setColors(initialProduct.color?.join(', ') || '');
      setWeight(initialProduct.weight?.toString() || '');
      setSellerNote(initialProduct.sellerNote || '');
      setMoq(initialProduct.moq?.toString() || '');
      setIsActive(initialProduct.isActive ?? true);
      setExistingImages(initialProduct.images || []);
    }
  }, [initialProduct]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

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
    });

    if (!result.canceled) {
      setImages(result.assets);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Product name is required');
      return;
    }

    if (!price || isNaN(parseFloat(price))) {
      Alert.alert('Validation Error', 'Valid price is required');
      return;
    }

    if (!stock || isNaN(parseInt(stock))) {
      Alert.alert('Validation Error', 'Valid stock quantity is required');
      return;
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: parseFloat(price),
      stock: parseInt(stock),
      category: category.trim() || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
      sizes: sizes ? sizes.split(',').map(s => s.trim()).filter(s => s) : [],
      color: colors ? colors.split(',').map(c => c.trim()).filter(c => c) : [],
      weight: weight ? parseFloat(weight) : undefined,
      sellerNote: sellerNote.trim() || undefined,
      moq: moq ? parseInt(moq) : undefined,
      isActive,
      images: images.length > 0 ? images : undefined,
    };

    const result = await updateProduct(productId, updateData);

    if (result) {
      Alert.alert('Success', 'Product updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    }
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
              <Text style={styles.imagePickerIcon}>📷</Text>
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
                        <Text style={styles.removeImageText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Product Name */}
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

          {/* Description */}
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
            />
          </View>

          {/* Price and Stock Row */}
          <View style={styles.row}>
            <View style={[styles.section, styles.halfWidth]}>
              <Text style={styles.label}>Price * ($)</Text>
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

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Electronics, Clothing"
              placeholderTextColor={Colors.gray400}
            />
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.label}>Tags</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="Comma-separated tags"
              placeholderTextColor={Colors.gray400}
            />
            <Text style={styles.hint}>Separate tags with commas</Text>
          </View>

          {/* Sizes */}
          <View style={styles.section}>
            <Text style={styles.label}>Sizes</Text>
            <TextInput
              style={styles.input}
              value={sizes}
              onChangeText={setSizes}
              placeholder="e.g., S, M, L, XL"
              placeholderTextColor={Colors.gray400}
            />
            <Text style={styles.hint}>Separate sizes with commas</Text>
          </View>

          {/* Colors */}
          <View style={styles.section}>
            <Text style={styles.label}>Colors</Text>
            <TextInput
              style={styles.input}
              value={colors}
              onChangeText={setColors}
              placeholder="e.g., Red, Blue, Green"
              placeholderTextColor={Colors.gray400}
            />
            <Text style={styles.hint}>Separate colors with commas</Text>
          </View>

          {/* Weight and MOQ Row */}
          <View style={styles.row}>
            <View style={[styles.section, styles.halfWidth]}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder="0.0"
                placeholderTextColor={Colors.gray400}
                keyboardType="decimal-pad"
              />
            </View>

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

          {/* Seller Note */}
          <View style={styles.section}>
            <Text style={styles.label}>Seller Note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={sellerNote}
              onChangeText={setSellerNote}
              placeholder="Any additional notes for buyers"
              placeholderTextColor={Colors.gray400}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>Update Product</Text>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
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
  imagePickerIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  imagePickerText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
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
    backgroundColor: Colors.error,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  removeImageText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
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