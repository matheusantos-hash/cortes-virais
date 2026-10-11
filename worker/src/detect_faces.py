#!/usr/bin/env python3
"""
detect_faces.py — Detecção e rastreamento facial inteligente de alta precisão.
Arquitetura Multi-Backend:
  1) Google MediaPipe Face Detection (BlazeFace Short/Full Range):
     - Rastreamento sub-milimétrico em CPU leve.
     - Robusto a rotações severas (yaw/pitch/roll até 90°), expressões e perfis.
     - Fornece marcos faciais (landmarks) com coordenada exata do centro da boca.
  2) OpenCV Multi-Cascade Ensemble (Fallback Universal):
     - Combinação de Frontal Face + Profile Face + Profile Flipped (horizontal).
     - Equalização adaptativa de contraste CLAHE (para ambientes de podcast com sombras).
     - Non-Maximum Suppression (NMS) com IoU para unificação de caixas e corte de falsos positivos.
     - Validação de aspect-ratio biométrico.
Suporta:
  1) Modo imagem única: python3 detect_faces.py <image_path>
  2) Modo rastreamento temporal: python3 detect_faces.py --video <video_path> --start <sec> --duration <sec> [--step <sec>] [--mode tracking|group]
"""
import sys
import json
import os
import argparse

def nms_boxes(boxes, scores=None, iou_thresh=0.35):
    """
    Non-Maximum Suppression (NMS) para eliminar detecções sobrepostas [x, y, w, h].
    """
    if not boxes:
        return []

    rects = []
    for b in boxes:
        x, y, w, h = b[:4]
        rects.append([float(x), float(y), float(x + w), float(y + h)])

    try:
        import numpy as np
        rects_arr = np.array(rects, dtype=float)
        if scores is None:
            areas = (rects_arr[:, 2] - rects_arr[:, 0]) * (rects_arr[:, 3] - rects_arr[:, 1])
            scores_arr = areas
        else:
            scores_arr = np.array(scores, dtype=float)

        x1 = rects_arr[:, 0]
        y1 = rects_arr[:, 1]
        x2 = rects_arr[:, 2]
        y2 = rects_arr[:, 3]

        areas = (x2 - x1) * (y2 - y1)
        order = scores_arr.argsort()[::-1]

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)

            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0.0, xx2 - xx1)
            h = np.maximum(0.0, yy2 - yy1)
            inter = w * h
            ovr = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)

            inds = np.where(ovr <= iou_thresh)[0]
            order = order[inds + 1]

        return [boxes[k] for k in keep]
    except Exception:
        # Fallback simples caso numpy falhe
        return boxes

class MediaPipeFaceDetector:
    def __init__(self):
        import mediapipe as mp
        self.mp_face_detection = mp.solutions.face_detection
        # model_selection=1: Modelo Full-Range (ideal para podcasts, oradores de 1 a 5 metros)
        self.detector = self.mp_face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.42
        )

    def detect(self, frame_bgr):
        import cv2
        h, w = frame_bgr.shape[:2]
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self.detector.process(frame_rgb)
        if not results.detections:
            return []

        detected = []
        for det in results.detections:
            score = float(det.score[0]) if det.score else 0.5
            bbox = det.location_data.relative_bounding_box
            xmin = max(0.0, float(bbox.xmin))
            ymin = max(0.0, float(bbox.ymin))
            bw = min(1.0 - xmin, float(bbox.width))
            bh = min(1.0 - ymin, float(bbox.height))

            aspect = bw / (bh + 1e-6)
            if aspect < 0.45 or aspect > 1.85:
                continue

            cx = xmin + bw / 2.0
            cy = ymin + bh / 2.0
            area = bw * bh

            if area < 0.002:
                continue

            mouth_center = None
            try:
                # Keypoint 3 no MediaPipe Face Detection é o ponto central dos lábios
                kp3 = det.location_data.keypoints[3]
                mouth_center = (float(kp3.x), float(kp3.y))
            except Exception:
                mouth_center = (cx, ymin + bh * 0.76)

            detected.append({
                "center_x": round(cx, 4),
                "center_y": round(cy, 4),
                "norm_box": [xmin, ymin, bw, bh],
                "area": area,
                "mouth_center": mouth_center,
                "confidence": round(score, 3),
                "backend": "mediapipe"
            })

        detected.sort(key=lambda f: f["area"], reverse=True)
        return detected

class CascadeFaceDetector:
    def __init__(self):
        import cv2
        self.frontal_cascade = self._load_cascade([
            getattr(cv2, 'data', None) and cv2.data.haarcascades + "haarcascade_frontalface_default.xml",
            getattr(cv2, 'data', None) and cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml",
            "/usr/share/opencv4/haarcascades/haarcascade_frontalface_default.xml",
            "/usr/share/opencv/haarcascades/haarcascade_frontalface_default.xml",
            "haarcascade_frontalface_default.xml"
        ], "haarcascade_frontalface_default.xml")

        self.profile_cascade = self._load_cascade([
            getattr(cv2, 'data', None) and cv2.data.haarcascades + "haarcascade_profileface.xml",
            "/usr/share/opencv4/haarcascades/haarcascade_profileface.xml",
            "/usr/share/opencv/haarcascades/haarcascade_profileface.xml",
            "haarcascade_profileface.xml"
        ], "haarcascade_profileface.xml")

    def _load_cascade(self, candidate_paths, default_name):
        import cv2
        for p in candidate_paths:
            if p and os.path.exists(p):
                c = cv2.CascadeClassifier(p)
                if not c.empty():
                    return c
        try:
            if hasattr(cv2, "data") and hasattr(cv2.data, "haarcascades"):
                return cv2.CascadeClassifier(cv2.data.haarcascades + default_name)
        except Exception:
            pass
        return None

    def detect(self, frame_bgr):
        import cv2
        h, w = frame_bgr.shape[:2]
        scale = 1.0
        if w > 640:
            scale = 640.0 / float(w)
            frame_proc = cv2.resize(frame_bgr, (640, int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            frame_proc = frame_bgr

        ph, pw = frame_proc.shape[:2]
        gray = cv2.cvtColor(frame_proc, cv2.COLOR_BGR2GRAY)

        # Equalização adaptativa de contraste (CLAHE) para balancear iluminação em estúdios
        try:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            gray_eq = clahe.apply(gray)
        except Exception:
            gray_eq = gray

        min_w = int(pw * 0.05)
        min_h = int(ph * 0.05)

        raw_boxes = []
        raw_scores = []

        # 1. Rostos frontais
        if self.frontal_cascade and not self.frontal_cascade.empty():
            faces_front = self.frontal_cascade.detectMultiScale(
                gray_eq,
                scaleFactor=1.10,
                minNeighbors=4,
                minSize=(min_w, min_h)
            )
            for (x, y, fw, fh) in faces_front:
                aspect = float(fw) / float(fh)
                if 0.65 <= aspect <= 1.45:
                    raw_boxes.append([x, y, fw, fh])
                    raw_scores.append(1.0)

        # 2. Rostos de perfil (perfil direito)
        if self.profile_cascade and not self.profile_cascade.empty():
            faces_prof = self.profile_cascade.detectMultiScale(
                gray_eq,
                scaleFactor=1.12,
                minNeighbors=4,
                minSize=(min_w, min_h)
            )
            for (x, y, fw, fh) in faces_prof:
                aspect = float(fw) / float(fh)
                if 0.60 <= aspect <= 1.50:
                    raw_boxes.append([x, y, fw, fh])
                    raw_scores.append(0.85)

            # 3. Rostos de perfil invertidos (perfil esquerdo com flip)
            gray_flipped = cv2.flip(gray_eq, 1)
            faces_prof_flip = self.profile_cascade.detectMultiScale(
                gray_flipped,
                scaleFactor=1.12,
                minNeighbors=4,
                minSize=(min_w, min_h)
            )
            for (fx, fy, ffw, ffh) in faces_prof_flip:
                aspect = float(ffw) / float(ffh)
                if 0.60 <= aspect <= 1.50:
                    orig_x = pw - (fx + ffw)
                    raw_boxes.append([orig_x, fy, ffw, ffh])
                    raw_scores.append(0.85)

        if not raw_boxes:
            return []

        filtered_boxes = nms_boxes(raw_boxes, raw_scores, iou_thresh=0.35)

        detected = []
        for (x, y, fw, fh) in filtered_boxes:
            cx = (x + fw / 2.0) / float(pw)
            cy = (y + fh / 2.0) / float(ph)
            area = float(fw * fh) / float(pw * ph)
            detected.append({
                "center_x": round(cx, 4),
                "center_y": round(cy, 4),
                "norm_box": [x / float(pw), y / float(ph), fw / float(pw), fh / float(ph)],
                "area": area,
                "mouth_center": (cx, (y + fh * 0.76) / float(ph)),
                "confidence": 0.8,
                "backend": "cascade_ensemble"
            })

        detected.sort(key=lambda f: f["area"], reverse=True)
        return detected

_global_detector = None

def get_face_detector():
    """Retorna o melhor detector facial disponível no ambiente."""
    global _global_detector
    if _global_detector is not None:
        return _global_detector

    # Prioridade 1: Google MediaPipe
    try:
        _global_detector = MediaPipeFaceDetector()
        return _global_detector
    except Exception:
        pass

    # Prioridade 2: OpenCV Multi-Cascade Ensemble
    try:
        _global_detector = CascadeFaceDetector()
        return _global_detector
    except Exception:
        pass

    return None

def detect_faces_in_frame(frame, detector=None):
    if detector is None:
        detector = get_face_detector()
    if detector is None:
        return []
    return detector.detect(frame)

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

        detector = get_face_detector()
        detected = detect_faces_in_frame(img, detector)

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

        detector = get_face_detector()
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

            detected = detect_faces_in_frame(frame, detector)
            if detected:
                has_detected_any = True
                raw_x = detected[0]["center_x"]

                lefts = [f["center_x"] for f in detected if f["center_x"] < 0.5]
                rights = [f["center_x"] for f in detected if f["center_x"] >= 0.5]
                if lefts: all_left_x.append(lefts[0])
                if rights: all_right_x.append(rights[0])

                # Suavização inteligente com Deadband e detecção de Jump Cut
                diff = abs(raw_x - last_x)
                if diff < 0.045:
                    # Deadband: micro-variação imperceptível, mantém câmera estável
                    smooth_x = last_x
                elif diff >= 0.28:
                    # Jump Cut / Troca de orador: corte seco sem pan enjoativo
                    smooth_x = raw_x
                else:
                    # Pan suave interpolado com EMA
                    smooth_x = 0.40 * raw_x + 0.60 * last_x

                last_x = smooth_x
                keyframes.append({"t": round(cur_t, 2), "x": round(smooth_x, 3)})
            else:
                # Mantém última posição estável para evitar saltos indesejados
                keyframes.append({"t": round(cur_t, 2), "x": round(last_x, 3)})

            cur_t += step_sec

        cap.release()

        if has_detected_any and keyframes:
            result["success"] = True
            result["keyframes"] = keyframes
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
    Rastreia participantes em podcast (mesa de oradores gravada com câmera fixa)
    e identifica o orador ativo com análise multimodal:
      - Detecção espacial robusta (MediaPipe / Cascade Ensemble)
      - Medição de atividade labial precisa em ROI focado (Lip Motion & Sobel Y Gradient)
      - Regras de direção de TV com histerese temporal (1.2s debounce)
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

        detector = get_face_detector()

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
                faces = detect_faces_in_frame(frame, detector)
                for f in faces:
                    detected_centers.append(f["center_x"])

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

        # 2. Rastreamento temporal de atividade labial
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

            faces = detect_faces_in_frame(frame_a_p, detector)
            scores = [0.0] * len(participant_positions)

            for f in faces:
                fcx = f["center_x"]
                best_idx = min(range(len(participant_positions)), key=lambda i: abs(participant_positions[i] - fcx))
                if abs(participant_positions[best_idx] - fcx) > 0.16:
                    continue

                # Recorta a região bucal usando landmark exato ou bounding box
                mouth_pt = f.get("mouth_center")
                if mouth_pt:
                    mcx, mcy = mouth_pt
                    mw_pix = int(pw * f["norm_box"][2] * 0.45)
                    mh_pix = int(ph * f["norm_box"][3] * 0.35)
                    mx1 = max(0, int(mcx * pw - mw_pix / 2))
                    mx2 = min(pw, int(mcx * pw + mw_pix / 2))
                    my1 = max(0, int(mcy * ph - mh_pix / 2))
                    my2 = min(ph, int(mcy * ph + mh_pix / 2))
                else:
                    box = f["norm_box"]
                    fx = int(box[0] * pw)
                    fy = int(box[1] * ph)
                    fw = int(box[2] * pw)
                    fh = int(box[3] * ph)
                    my1 = int(fy + fh * 0.62)
                    my2 = int(fy + fh * 0.94)
                    mx1 = int(fx + fw * 0.22)
                    mx2 = int(fx + fw * 0.78)

                if my2 > ph or mx2 > pw or my1 >= my2 or mx1 >= mx2:
                    continue

                mouth_a = gray_a[my1:my2, mx1:mx2]
                mouth_b = gray_b[my1:my2, mx1:mx2]

                # 1. Movimento labial inter-frame
                diff = cv2.absdiff(mouth_a, mouth_b)
                motion_val = float(np.mean(diff))

                # 2. Gradiente vertical de abertura bucal (Sobel Y)
                sobel_y = cv2.Sobel(mouth_a, cv2.CV_32F, 0, 1, ksize=3)
                grad_val = float(np.std(sobel_y))

                lip_activity = motion_val * 2.2 + grad_val * 0.4
                scores[best_idx] = max(scores[best_idx], lip_activity)

            max_s = max(scores) if scores else 0.0
            candidate_speaker = int(np.argmax(scores)) if (scores and max_s > 2.8) else None

            time_observations.append({
                "t": round(cur_t, 2),
                "speaker": candidate_speaker,
                "scores": [round(s, 2) for s in scores]
            })

            cur_t += step_sec

        cap.release()

        # 3. Regras de direção de TV (Debounce de 1.2s para evitar oscilações)
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
