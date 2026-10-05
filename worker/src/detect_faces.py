#!/usr/bin/env python3
"""
detect_faces.py — Detecta a posição dos rostos em imagens ou faz rastreamento temporal contínuo em vídeos.
Suporta:
  1) Modo imagem única: python3 detect_faces.py <image_path>
  2) Modo rastreamento temporal: python3 detect_faces.py --video <video_path> --start <sec> --duration <sec> [--step <sec>]
"""
import sys
import json
import os
import argparse

def get_face_cascade():
    import cv2
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
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return face_cascade

def detect_faces_in_frame(frame, face_cascade):
    import cv2
    h, w = frame.shape[:2]
    # Otimização de performance: redimensiona se for maior que 640px de largura
    scale = 1.0
    if w > 640:
        scale = 640.0 / float(w)
        frame_proc = cv2.resize(frame, (640, int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        frame_proc = frame

    ph, pw = frame_proc.shape[:2]
    gray = cv2.cvtColor(frame_proc, cv2.COLOR_BGR2GRAY)
    
    # Filtra rostos muito pequenos para evitar falsos positivos no fundo
    min_w = int(pw * 0.06)
    min_h = int(ph * 0.06)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.12,
        minNeighbors=4,
        minSize=(min_w, min_h)
    )

    detected = []
    for (x, y, fw, fh) in faces:
        cx = (x + fw / 2.0) / float(pw)
        cy = (y + fh / 2.0) / float(ph)
        area = float(fw * fh) / float(pw * ph)
        detected.append({
            "center_x": round(cx, 4),
            "center_y": round(cy, 4),
            "area": area
        })

    detected.sort(key=lambda f: f["area"], reverse=True)
    return detected

def detect_faces(image_path):
    result = {
        "faces": [],
        "primary_center_x": 0.5,
        "left_face_center_x": 0.25,
        "right_face_center_x": 0.75,
        "keyframes": [],
        "success": False
    }

    if not os.path.exists(image_path):
        return result

    try:
        import cv2
        img = cv2.imread(image_path)
        if img is None:
            return result

        cascade = get_face_cascade()
        detected = detect_faces_in_frame(img, cascade)

        if detected:
            result["success"] = True
            result["faces"] = detected
            result["primary_center_x"] = detected[0]["center_x"]

            left_candidates = [f for f in detected if f["center_x"] < 0.5]
            right_candidates = [f for f in detected if f["center_x"] >= 0.5]
            if left_candidates:
                result["left_face_center_x"] = left_candidates[0]["center_x"]
            if right_candidates:
                result["right_face_center_x"] = right_candidates[0]["center_x"]

    except Exception as e:
        sys.stderr.write(f"detect_faces error: {e}\n")

    return result

def track_faces_video(video_path, start_sec, duration_sec, step_sec=1.0):
    result = {
        "primary_center_x": 0.5,
        "left_face_center_x": 0.25,
        "right_face_center_x": 0.75,
        "keyframes": [],
        "success": False
    }

    if not os.path.exists(video_path):
        return result

    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return result

        cascade = get_face_cascade()
        keyframes = []
        last_x = 0.5
        has_detected_any = False

        all_left_x = []
        all_right_x = []

        cur_t = 0.0
        while cur_t <= duration_sec:
            target_ms = (start_sec + cur_t) * 1000.0
            cap.set(cv2.CAP_PROP_POS_MSEC, target_ms)
            ret, frame = cap.read()
            if not ret or frame is None:
                cur_t += step_sec
                continue

            detected = detect_faces_in_frame(frame, cascade)
            if detected:
                has_detected_any = True
                raw_x = detected[0]["center_x"]

                # Separa candidatos para podcast
                lefts = [f["center_x"] for f in detected if f["center_x"] < 0.5]
                rights = [f["center_x"] for f in detected if f["center_x"] >= 0.5]
                if lefts: all_left_x.append(lefts[0])
                if rights: all_right_x.append(rights[0])

                # Suavização inteligente com Deadband e detecção de Jump Cut
                diff = abs(raw_x - last_x)
                if diff < 0.05:
                    # Deadband: variação imperceptível, mantém câmera firme
                    smooth_x = last_x
                elif diff >= 0.28:
                    # Jump Cut / Troca de orador: corte seco sem pan enjoativo
                    smooth_x = raw_x
                else:
                    # Pan suave interpolado (EMA)
                    smooth_x = 0.40 * raw_x + 0.60 * last_x

                last_x = smooth_x
                keyframes.append({"t": round(cur_t, 2), "x": round(smooth_x, 3)})
            else:
                # Se perdeu o rosto pontualmente, mantém a última posição estável
                keyframes.append({"t": round(cur_t, 2), "x": round(last_x, 3)})

            cur_t += step_sec

        cap.release()

        if has_detected_any and keyframes:
            result["success"] = True
            result["keyframes"] = keyframes
            # Primary center X é a mediana das posições detectadas
            all_x = sorted([k["x"] for k in keyframes])
            result["primary_center_x"] = all_x[len(all_x) // 2]

            if all_left_x:
                all_left_x.sort()
                result["left_face_center_x"] = round(all_left_x[len(all_left_x) // 2], 3)
            if all_right_x:
                all_right_x.sort()
                result["right_face_center_x"] = round(all_right_x[len(all_right_x) // 2], 3)

    except Exception as e:
        sys.stderr.write(f"track_faces_video error: {e}\n")

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Argumentos insuficientes"}))
        sys.exit(1)

    if sys.argv[1] == "--video":
        parser = argparse.ArgumentParser()
        parser.add_argument("--video", required=True, help="Caminho do vídeo")
        parser.add_argument("--start", type=float, default=0.0, help="Segundo de início")
        parser.add_argument("--duration", type=float, default=30.0, help="Duração do trecho em segundos")
        parser.add_argument("--step", type=float, default=1.0, help="Passo de amostragem em segundos")
        args = parser.parse_args()

        data = track_faces_video(args.video, args.start, args.duration, args.step)
        print(json.dumps(data))
    else:
        image_path = sys.argv[1]
        data = detect_faces(image_path)
        print(json.dumps(data))
