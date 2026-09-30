#!/usr/bin/env python3
"""
detect_faces.py — Detecta a posição dos rostos em uma imagem/frame de vídeo
Retorna um JSON com as coordenadas normalizadas (0.0 a 1.0) dos rostos encontrados.
"""
import sys
import json
import os

def detect_faces(image_path):
    result = {
        "faces": [],
        "primary_center_x": 0.5,
        "left_face_center_x": 0.25,
        "right_face_center_x": 0.75,
        "success": False
    }

    if not os.path.exists(image_path):
        return result

    try:
        import cv2

        # Carrega a imagem
        img = cv2.imread(image_path)
        if img is None:
            return result

        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Caminhos comuns para o modelo Haar Cascade no Linux e Windows
        cascade_paths = [
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml" if hasattr(cv2, "data") else None,
            "/usr/share/opencv4/haarcascades/haarcascade_frontalface_default.xml",
            "/usr/share/opencv/haarcascades/haarcascade_frontalface_default.xml",
            "haarcascade_frontalface_default.xml"
        ]

        face_cascade = None
        for p in cascade_paths:
            if p and os.path.exists(p):
                face_cascade = cv2.CascadeClassifier(p)
                break

        if face_cascade is None or face_cascade.empty():
            # Tenta carregar direto pelo nome padrão
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(int(w * 0.04), int(h * 0.04))
        )

        detected = []
        for (x, y, fw, fh) in faces:
            center_x = (x + fw / 2.0) / float(w)
            center_y = (y + fh / 2.0) / float(h)
            detected.append({
                "x": float(x) / w,
                "y": float(y) / h,
                "width": float(fw) / w,
                "height": float(fh) / h,
                "center_x": round(center_x, 4),
                "center_y": round(center_y, 4),
                "area": float(fw * fh) / (w * h)
            })

        if detected:
            result["success"] = True
            # Ordena por área (maior rosto primeiro)
            detected.sort(key=lambda f: f["area"], reverse=True)
            result["faces"] = detected
            result["primary_center_x"] = detected[0]["center_x"]

            # Para podcast / entrevistas com 2 ou mais pessoas:
            # Separa os rostos da metade esquerda e da metade direita
            left_candidates = [f for f in detected if f["center_x"] < 0.5]
            right_candidates = [f for f in detected if f["center_x"] >= 0.5]

            if left_candidates:
                # O maior rosto da esquerda
                left_candidates.sort(key=lambda f: f["area"], reverse=True)
                result["left_face_center_x"] = left_candidates[0]["center_x"]

            if right_candidates:
                # O maior rosto da direita
                right_candidates.sort(key=lambda f: f["area"], reverse=True)
                result["right_face_center_x"] = right_candidates[0]["center_x"]

    except Exception as e:
        sys.stderr.write(f"detect_faces error: {e}\n")

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Informe o caminho da imagem"}))
        sys.exit(1)

    image_path = sys.argv[1]
    data = detect_faces(image_path)
    print(json.dumps(data))
