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

def track_group_speaker_video(video_path, start_sec, duration_sec, step_sec=0.5):
    """
    Rastreia participantes em podcast (mesa de até 4 pessoas gravada com câmera fixa)
    e identifica o orador ativo usando a Opção A:
      - Detecção de clusters de participantes na horizontal (X)
      - Medição de atividade e abertura labial (Lip Motion / Mouth Variance)
      - Regras de direção de corte (Histerese temporal de 1.2s para evitar oscilações)
    """
    default_clusters = [0.18, 0.38, 0.62, 0.82]
    result = {
        "primary_center_x": 0.38,
        "left_face_center_x": 0.25,
        "right_face_center_x": 0.75,
        "participants": default_clusters,
        "keyframes": [
            {"t": 0.0, "x": 0.38, "speaker_idx": 1}
        ],
        "success": False,
        "mode": "group"
    }

    if not os.path.exists(video_path):
        return result

    try:
        import cv2
        import numpy as np

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return result

        cascade = get_face_cascade()

        # 1. Mapeamento de participantes (clusters espaciais no eixo X)
        sample_times = [
            start_sec,
            start_sec + duration_sec * 0.25,
            start_sec + duration_sec * 0.50,
            start_sec + duration_sec * 0.75
        ]

        detected_centers = []
        for st in sample_times:
            cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, st * 1000.0))
            ret, frame = cap.read()
            if ret and frame is not None:
                faces = detect_faces_in_frame(frame, cascade)
                for f in faces:
                    detected_centers.append(f["center_x"])

        # Agrupa coordenadas X próximas (limiar de 0.12 na largura relativa)
        clusters = []
        for cx in sorted(detected_centers):
            matched = False
            for c in clusters:
                if abs(c["x"] - cx) < 0.12:
                    c["x"] = round((c["x"] * c["count"] + cx) / (c["count"] + 1), 3)
                    c["count"] += 1
                    matched = True
                    break
            if not matched:
                clusters.append({"x": cx, "count": 1})

        clusters.sort(key=lambda c: c["x"])
        participant_positions = [c["x"] for c in clusters[:4]] if clusters else default_clusters
        if not participant_positions:
            participant_positions = default_clusters

        # 2. Rastreamento temporal de atividade labial (Opção A)
        cur_t = 0.0
        time_observations = []
        speaker_time_spent = {idx: 0.0 for idx in range(len(participant_positions))}

        while cur_t <= duration_sec:
            target_ms_a = (start_sec + cur_t) * 1000.0
            cap.set(cv2.CAP_PROP_POS_MSEC, target_ms_a)
            ret_a, frame_a = cap.read()

            target_ms_b = target_ms_a + 100.0
            cap.set(cv2.CAP_PROP_POS_MSEC, target_ms_b)
            ret_b, frame_b = cap.read()

            if not ret_a or frame_a is None:
                cur_t += step_sec
                continue

            h, w = frame_a.shape[:2]
            scale = 1.0
            if w > 640:
                scale = 640.0 / float(w)
                frame_a_p = cv2.resize(frame_a, (640, int(h * scale)), interpolation=cv2.INTER_AREA)
                frame_b_p = cv2.resize(frame_b, (640, int(h * scale)), interpolation=cv2.INTER_AREA) if (ret_b and frame_b is not None) else frame_a_p
            else:
                frame_a_p = frame_a
                frame_b_p = frame_b if (ret_b and frame_b is not None) else frame_a

            gray_a = cv2.cvtColor(frame_a_p, cv2.COLOR_BGR2GRAY)
            gray_b = cv2.cvtColor(frame_b_p, cv2.COLOR_BGR2GRAY)
            ph, pw = gray_a.shape[:2]

            min_w = int(pw * 0.06)
            min_h = int(ph * 0.06)
            faces = cascade.detectMultiScale(gray_a, scaleFactor=1.12, minNeighbors=4, minSize=(min_w, min_h))

            scores = [0.0] * len(participant_positions)

            for (fx, fy, fw, fh) in faces:
                fcx = (fx + fw / 2.0) / float(pw)
                best_idx = min(range(len(participant_positions)), key=lambda i: abs(participant_positions[i] - fcx))
                if abs(participant_positions[best_idx] - fcx) > 0.16:
                    continue

                # Recorta a região bucal (terço inferior do rosto)
                my1 = int(fy + fh * 0.62)
                my2 = int(fy + fh * 0.94)
                mx1 = int(fx + fw * 0.22)
                mx2 = int(fx + fw * 0.78)

                if my2 > ph or mx2 > pw or my1 >= my2 or mx1 >= mx2:
                    continue

                mouth_a = gray_a[my1:my2, mx1:mx2]
                mouth_b = gray_b[my1:my2, mx1:mx2]

                # Opção A:
                # 1. Diferença de movimento labial frame-to-frame (motion delta)
                diff = cv2.absdiff(mouth_a, mouth_b)
                motion_val = float(np.mean(diff))

                # 2. Gradiente vertical de abertura bucal (Sobel vertical / dentes / cavidade oral)
                sobel_y = cv2.Sobel(mouth_a, cv2.CV_32F, 0, 1, ksize=3)
                grad_val = float(np.std(sobel_y))

                lip_activity = motion_val * 2.2 + grad_val * 0.4
                scores[best_idx] = max(scores[best_idx], lip_activity)

            max_s = max(scores) if scores else 0.0
            candidate_speaker = int(np.argmax(scores)) if (scores and max_s > 3.0) else None

            time_observations.append({
                "t": round(cur_t, 2),
                "speaker": candidate_speaker,
                "scores": [round(s, 2) for s in scores]
            })

            cur_t += step_sec

        cap.release()

        # 3. Aplicação das regras de direção de TV (Histerese / Debounce de 1.2s)
        keyframes = []
        current_speaker = 0
        current_speaker_streak = 0.0
        pending_speaker = None
        pending_streak = 0.0
        MIN_SPEECH_DURATION_TO_CUT = 1.2

        for obs in time_observations:
            obs_speaker = obs["speaker"]
            t = obs["t"]

            if obs_speaker is not None:
                if obs_speaker == current_speaker:
                    current_speaker_streak += step_sec
                    pending_speaker = None
                    pending_streak = 0.0
                else:
                    if obs_speaker == pending_speaker:
                        pending_streak += step_sec
                        if pending_streak >= MIN_SPEECH_DURATION_TO_CUT:
                            current_speaker = pending_speaker
                            current_speaker_streak = pending_streak
                            pending_speaker = None
                            pending_streak = 0.0
                            keyframes.append({
                                "t": round(t, 2),
                                "x": round(participant_positions[current_speaker], 3),
                                "speaker_idx": current_speaker
                            })
                    else:
                        pending_speaker = obs_speaker
                        pending_streak = step_sec
            else:
                current_speaker_streak += step_sec
                pending_streak = max(0.0, pending_streak - step_sec * 0.5)

            speaker_time_spent[current_speaker] = speaker_time_spent.get(current_speaker, 0.0) + step_sec

        if not keyframes:
            keyframes.append({
                "t": 0.0,
                "x": round(participant_positions[current_speaker], 3),
                "speaker_idx": current_speaker
            })
        elif keyframes[0]["t"] > 0.0:
            keyframes.insert(0, {
                "t": 0.0,
                "x": round(participant_positions[0], 3),
                "speaker_idx": 0
            })

        most_active_speaker = max(speaker_time_spent.keys(), key=lambda k: speaker_time_spent[k])
        primary_x = participant_positions[most_active_speaker]

        result["success"] = True
        result["primary_center_x"] = round(primary_x, 3)
        result["left_face_center_x"] = round(participant_positions[0], 3)
        result["right_face_center_x"] = round(participant_positions[-1], 3)
        result["participants"] = participant_positions
        result["keyframes"] = keyframes
        result["mode"] = "group"

    except Exception as e:
        sys.stderr.write(f"track_group_speaker_video error: {e}\n")

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
        parser.add_argument("--step", type=float, default=0.5, help="Passo de amostragem em segundos")
        parser.add_argument("--mode", type=str, default="tracking", choices=["tracking", "group"], help="Modo de rastreamento")
        args = parser.parse_args()

        if args.mode == "group":
            data = track_group_speaker_video(args.video, args.start, args.duration, args.step)
        else:
            data = track_faces_video(args.video, args.start, args.duration, args.step)
        print(json.dumps(data))
    else:
        image_path = sys.argv[1]
        data = detect_faces(image_path)
        print(json.dumps(data))

