import os
from PIL import Image
from torch.utils.data import Dataset

class DermaDataset(Dataset):
    def __init__(self, base_dir, split='train', transform=None):
        self.transform = transform
        self.image_paths = []
        self.type_labels = []
        self.condition_labels = []

        # Directory structure mappings
        self.type_map = {'combination': 0, 'dry': 1, 'normal': 2, 'oily': 3}
        
        # Explicit folder-to-label map for your skin_conditions directory
        self.condition_map = {
            'normal baseline': 0,
            'inflammatory acne': 1,
            'non inflammatory acne black heads': 2,
            'non inflammatory acne white heads': 3,
            'pores': 4,
            'dark spots': 5,
            'pigmentation': 5, # Map pigmentation folder directly to dark spots class
            'redness': 0,      # Folders not explicitly in your 7 classes default safely
            'wrinkles': 6
        }

        self.types_dir = os.path.join(base_dir, 'skin_types', split)
        self.conditions_dir = os.path.join(base_dir, 'skin_conditions')

        self._assemble_dataset(split)

    def _assemble_dataset(self, split):
        # --- PHASE 1: Parse Skin Types folders ---
        type_count = 0
        if os.path.exists(self.types_dir):
            for folder_name in os.listdir(self.types_dir):
                clean_folder = folder_name.lower().strip()
                if clean_folder in self.type_map:
                    target_type = self.type_map[clean_folder]
                    folder_path = os.path.join(self.types_dir, folder_name)
                    
                    if os.path.isdir(folder_path):
                        for img_file in os.listdir(folder_path):
                            if img_file.lower().endswith(('png', 'jpg', 'jpeg')):
                                self.image_paths.append(os.path.join(folder_path, img_file))
                                self.type_labels.append(target_type)
                                # Images inside skin_types are structural baselines
                                self.condition_labels.append(0) 
                                type_count += 1

        # --- PHASE 2: Parse Skin Conditions folders directly ---
        # To avoid double-counting condition folders across train/valid splits,
        # we will route half to train and half to validation deterministically.
        cond_count = 0
        if os.path.exists(self.conditions_dir):
            for folder_name in os.listdir(self.conditions_dir):
                clean_folder = folder_name.lower().strip()
                if clean_folder in self.condition_map:
                    target_cond = self.condition_map[clean_folder]
                    folder_path = os.path.join(self.conditions_dir, folder_name)
                    
                    if os.path.isdir(folder_path):
                        # Sort filenames to ensure a stable distribution split
                        all_imgs = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(('png', 'jpg', 'jpeg'))])
                        
                        # Pseudo-split the condition folder: 80% train, 20% validation
                        split_idx = int(len(all_imgs) * 0.8)
                        selected_imgs = all_imgs[:split_idx] if split == 'train' else all_imgs[split_idx:]
                        
                        for img_file in selected_imgs:
                            self.image_paths.append(os.path.join(folder_path, img_file))
                            # Default type to 2 ('normal') for condition images
                            self.type_labels.append(2) 
                            self.condition_labels.append(target_cond)
                            cond_count += 1

        print(f"\n====== {split.upper()} HYBRID PARSER STATS ======")
        print(f"[✓] Loaded from Skin Types folders: {type_count}")
        print(f"[✓] Loaded from Skin Conditions folders: {cond_count}")
        print(f"[*] Total indexed images for processing loop: {len(self.image_paths)}")
        
        # Calculate real data balance
        from collections import Counter
        type_counts = Counter(self.type_labels)
        cond_counts = Counter(self.condition_labels)
        print(f"[*] Distribution Types: {dict(type_counts)}")
        print(f"[*] Distribution Conditions: {dict(cond_counts)}")
        print("==================================================\n")

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        image = Image.open(self.image_paths[idx]).convert('RGB')
        if self.transform:
            image = self.transform(image)
        return image, self.type_labels[idx], self.condition_labels[idx]