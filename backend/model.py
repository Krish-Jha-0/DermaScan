import torch
import torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights

class DermaNetMultiTask(nn.Module):
    def __init__(self, num_types=4, num_conditions=7):
        super(DermaNetMultiTask, self).__init__()
        
        # Pull pre-trained weights to handle fine feature distributions smoothly
        self.backbone = resnet18(weights=ResNet18_Weights.DEFAULT)
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Identity()
        
        # Shared processing layer
        self.fc_shared = nn.Linear(in_features, 256)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3)
        
        # Target optimization execution heads
        self.type_head = nn.Linear(256, num_types)
        self.condition_head = nn.Linear(256, num_conditions)

    def forward(self, x):
        features = self.backbone(x)
        shared_out = self.dropout(self.relu(self.fc_shared(features)))
        return self.type_head(shared_out), self.condition_head(shared_out)