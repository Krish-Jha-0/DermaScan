import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import transforms
from torch.utils.data import DataLoader
from model import DermaNetMultiTask
from dataset_loader import DermaDataset
from tqdm import tqdm  # Explicit progress visualization engine

def run_training_pipeline():
    transform_pipeline = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_dataset = DermaDataset(base_dir='.', split='train', transform=transform_pipeline)
    valid_dataset = DermaDataset(base_dir='.', split='valid', transform=transform_pipeline)
    
    # num_workers=0 is safest for local CPU runs to prevent Windows multiprocessing overhead
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True, drop_last=True, num_workers=0)
    valid_loader = DataLoader(valid_dataset, batch_size=16, shuffle=False, num_workers=0)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Node processing assignment context: {device}")

    if len(train_dataset) == 0:
        print("[!] Critical Failure: Dataset parsed to zero units. Run verification cycles.")
        return

    model = DermaNetMultiTask(num_types=4, num_conditions=7).to(device)
    optimizer = optim.AdamW(model.parameters(), lr=0.0001, weight_decay=0.01)
    criterion = nn.CrossEntropyLoss()

    epochs = 30
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        
        # Wrapped training loop with tqdm for dynamic metrics updates
        progress_bar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}", unit="batch")
        
        for images, type_targets, cond_targets in progress_bar:
            images, type_targets, cond_targets = images.to(device), type_targets.to(device), cond_targets.to(device)
            
            optimizer.zero_grad()
            type_preds, cond_preds = model(images)
            
            loss_type = criterion(type_preds, type_targets)
            loss_condition = criterion(cond_preds, cond_targets)
            
            total_loss = loss_type + loss_condition
            total_loss.backward()
            optimizer.step()
            
            running_loss += total_loss.item()
            
            # Update the progress bar description text with current batch loss info
            progress_bar.set_postfix(loss=f"{total_loss.item():.4f}")

        # Validation cycle
        model.eval()
        type_correct, cond_correct, total = 0, 0, 0
        with torch.no_grad():
            for images, type_targets, cond_targets in valid_loader:
                images, type_targets, cond_targets = images.to(device), type_targets.to(device), cond_targets.to(device)
                type_preds, cond_preds = model(images)
                
                type_correct += (torch.argmax(type_preds, dim=1) == type_targets).sum().item()
                cond_correct += (torch.argmax(cond_preds, dim=1) == cond_targets).sum().item()
                total += type_targets.size(0)

        type_acc = (type_correct / total) * 100 if total > 0 else 0
        cond_acc = (cond_correct / total) * 100 if total > 0 else 0
        
        print(f"\n➔ Finished Epoch {epoch+1}/{epochs} | Avg Loss: {running_loss/len(train_loader):.4f} | Type Acc: {type_acc:.1f}% | Condition Acc: {cond_acc:.1f}%\n")

    torch.save(model.state_dict(), 'dermascan_brain.pth')
    print("[✓] Model optimization weights file exported.")

if __name__ == '__main__':
    run_training_pipeline()