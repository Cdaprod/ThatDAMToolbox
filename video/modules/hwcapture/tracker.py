# video/modules/hwcapture/tracker.py
import cv2
import numpy as np

class WitnessTracker:
    """
    Lightweight KLT-based tracker that outputs a 2×3 affine matrix
    describing the motion between consecutive Insta360 frames.
    """

    def __init__(self, max_corners=500, quality=0.01, min_dist=7):
        self.feature_params = dict(maxCorners=max_corners,
                                   qualityLevel=quality,
                                   minDistance=min_dist,
                                   blockSize=7)
        self.lk_params = dict(winSize=(21, 21),
                              criteria=(cv2.TERM_CRITERIA_EPS |
                                        cv2.TERM_CRITERIA_COUNT, 30, 0.01))
        self.prev_gray = None
        self.prev_pts  = None

    def update(self, frame_bgr) -> np.ndarray:
        """Return 2×3 affine transform that best aligns prev→current."""
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)

        if self.prev_gray is None:
            self.prev_gray = gray
            self.prev_pts  = cv2.goodFeaturesToTrack(gray, **self.feature_params)
            return np.eye(2, 3, dtype=np.float32)          # identity

        next_pts, st, _ = cv2.calcOpticalFlowPyrLK(self.prev_gray, gray,
                                                   self.prev_pts, None,
                                                   **self.lk_params)
        good_prev = self.prev_pts[st == 1]
        good_next = next_pts[st == 1]

        if len(good_prev) < 6:             # too few matches → reset tracker
            self.prev_gray, self.prev_pts = gray, None
            return np.eye(2, 3, dtype=np.float32)

        M, _ = cv2.estimateAffinePartial2D(good_prev, good_next,
                                           method=cv2.RANSAC, ransacReprojThreshold=3)
        if M is None:
            M = np.eye(2, 3, dtype=np.float32)

        self.prev_gray, self.prev_pts = gray, good_next.reshape(-1, 1, 2)
        return M