import os
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from torchvision import transforms
import io

# Import your neural framework layout
from model import DermaNetMultiTask

app = Flask(__name__)

# Explicit CORS policy configuration bounding local Vite development instances
CORS(app, cors_allowed_origins="*", resources={r"/api/*": {"origins": "*"}})

# Reverse index configurations to translate neural predictions back to screen strings
TYPE_LABELS = ['Combination', 'Dry', 'Normal', 'Oily']
CONDITION_LABELS = ['Normal Baseline', 'Acne', 'Blackheads', 'Whiteheads', 'Open Pores', 'Dark Spots', 'Wrinkles']

# Master Permutations & Combinations Ingredient Engine
INGREDIENT_MATRIX = {
    "Combination": {
        "Normal Baseline": "Centella Asiatica (Cica) to maintain overall sebum-moisture balance.",
        "Acne": "Salicylic Acid (BHA) applied strictly as a spot-treatment on active T-zone flare-ups.",
        "Blackheads": "BHA Liquid Toner targeting the nose and forehead zones to dissolve sebum plugs.",
        "Whiteheads": "A gentle AHA/BHA exfoliating blend to accelerate cell turnover cleanly.",
        "Open Pores": "Niacinamide serum to tighten skin elasticity around the nose and cheeks.",
        "Dark Spots": "Kojic Acid to fade hyperpigmentation without triggering excessive oiliness.",
        "Wrinkles": "Bakuchiol or a mild Retinol serum to stimulate cellular collagen matrix updates."
    },
    "Dry": {
        "Normal Baseline": "Hyaluronic Acid in a heavy ceramide cream base to lock in structural hydration.",
        "Acne": "Sulfur or low-dose Benzoyl Peroxide to clear bacteria without stripping the moisture barrier.",
        "Blackheads": "Mandelic Acid—an ultra-gentle, oil-soluble AHA that won't flake dry skin.",
        "Whiteheads": "Lactic Acid, which exfoliates the skin surface while acting as a natural humectant.",
        "Open Pores": "Polyhydroxy Acids (PHAs) to gently smooth out surface texture without irritation.",
        "Dark Spots": "Vitamin C formulated in a nourishing Vitamin E or Squalane oil delivery base.",
        "Wrinkles": "Retinol formulated in a rich, deeply emollient cream base to counter drying side-effects."
    },
    "Normal": {
        "Normal Baseline": "Green Tea Extract or generic antioxidants to maintain healthy skin barrier states.",
        "Acne": "Azelaic Acid to kill active acne bacteria while keeping redness completely subdued.",
        "Blackheads": "A mild Clay Mask followed by a 1% BHA liquid sweep once or twice a week.",
        "Whiteheads": "Glycolic Acid (AHA) toner to keep the top dead skin layers completely clear.",
        "Open Pores": "Cold-pressed Rosehip Seed Oil to maintain skin plumpness and smooth out micro-textures.",
        "Dark Spots": "Pure L-Ascorbic Acid (Vitamin C) serum to brighten up uneven tone profile boundaries.",
        "Wrinkles": "A high-tier Peptide Complex serum alongside standard sunscreen configurations."
    },
    "Oily": {
        "Normal Baseline": "Niacinamide to naturally control sebaceous gland activity and reduce daytime shine.",
        "Acne": "2% Salicylic Acid (BHA) to penetrate deep into lipid layers and unclog inside pores.",
        "Blackheads": "2% BHA solution to systematically melt stubborn sebaceous filaments and oxidized plugs.",
        "Whiteheads": "Glycolic Acid (AHA) peeling solution to clear micro-obstructions over pore nodes.",
        "Open Pores": "Niacinamide + Zinc PCA serum to dry up excess sebum and visibly reduce pore size.",
        "Dark Spots": "Alpha Arbutin or Niacinamide to stop melanin transfer while regulating oil production.",
        "Wrinkles": "A lightweight, water-based Retinol gel or fluid serum to keep texturing tight."
    }
}

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Instantiating Multi-Task Model (4 types, 7 conditions matching your train logic)
model = DermaNetMultiTask(num_types=4, num_conditions=7)
MODEL_WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), 'dermascan_brain.pth')

if os.path.exists(MODEL_WEIGHTS_PATH):
    model.load_state_dict(torch.load(MODEL_WEIGHTS_PATH, map_location=device))
    print("[OK] Custom Multi-Task Model Weights Injected Into API Core Instance.")
else:
    print("[!] dermascan_brain.pth weights missing from local database directory partition.")

model.to(device)
model.eval()

eval_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

@app.route('/api/scan', methods=['POST'])
def process_scan():
    if 'image' not in request.files:
        return jsonify({"error": "No image payload found"}), 400
        
    file = request.files['image']
    try:
        raw_img = Image.open(io.BytesIO(file.read())).convert('RGB')
        tensor_img = eval_transform(raw_img).unsqueeze(0).to(device)

        with torch.no_grad():
            type_logits, cond_logits = model(tensor_img)
            
            # Apply softmax to calculate confidence probabilities
            type_probs = torch.softmax(type_logits, dim=1)[0]
            cond_probs = torch.softmax(cond_logits, dim=1)[0]
            
            pred_type_idx = torch.argmax(type_probs).item()
            pred_cond_idx = torch.argmax(cond_probs).item()
            
            type_conf = int(round(type_probs[pred_type_idx].item() * 100))
            cond_conf = int(round(cond_probs[pred_cond_idx].item() * 100))

        # Resolve string tags based on index mapping coordinates
        predicted_skin_type = TYPE_LABELS[pred_type_idx]
        predicted_condition = CONDITION_LABELS[pred_cond_idx]

        # Algorithmic ingredient resolution block based on our 28-way matrix mapping
        resolved_ingredient = INGREDIENT_MATRIX.get(predicted_skin_type, {}).get(
            predicted_condition, "Consult a primary dermatologist for a custom product blueprint."
        )

        return jsonify({
            "success": True,
            "skin_type": predicted_skin_type,
            "skin_condition": predicted_condition,
            "condition_confidence": cond_conf,
            "alternative_confidence": 100 - cond_conf,
            "recommended_ingredient": resolved_ingredient,
            "message": f"Analysis complete. Profile indicates {predicted_skin_type} skin with signs of {predicted_condition}."
        }), 200

    except Exception as e:
        print(f"[ERROR] EXECUTION CRASH: {str(e)}")
        return jsonify({"error": f"Internal system diagnostics fault: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)