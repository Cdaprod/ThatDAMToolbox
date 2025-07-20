// /video/web/static/components/live-preview.js

document.addEventListener("DOMContentLoaded", () => {
  const selects  = Array.from(document.querySelectorAll(".capDev"));
  const previews = Array.from(document.querySelectorAll(".prevImg"));
  const btn      = document.getElementById("startAll");
  let recording  = false;

  if (!selects.length || !previews.length || !btn) {
    console.error("live-preview.js: Required elements not found.");
    return;
  }
  if (selects.length !== previews.length) {
    console.error("live-preview.js: .capDev and .prevImg count mismatch.");
    return;
  }

  // 1) Fetch available devices and populate selects
  fetch("/hwcapture/devices")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch devices");
      return res.json();
    })
    .then((devices) => {
      if (!Array.isArray(devices) || devices.length === 0) {
        throw new Error("No capture devices found");
      }
      selects.forEach((sel, idx) => {
        sel.innerHTML = ""; // clear existing options
        devices.forEach((dev) => {
          const opt = document.createElement("option");
          opt.value = dev.path;
          opt.textContent = `${dev.path} (${dev.width}×${dev.height}@${dev.fps}fps)`;
          sel.appendChild(opt);
        });
        // default to first device and trigger preview update
        sel.selectedIndex = 0;
        sel.dispatchEvent(new Event("change"));
      });
    })
    .catch((err) => {
      selects.forEach(sel => sel.innerHTML = '<option disabled>No devices found</option>');
      previews.forEach(img => img.src = "");
      console.error("live-preview.js:", err);
    });

  // 2) On select change, point preview <img> to the MJPEG stream
  selects.forEach((sel, idx) => {
    sel.addEventListener("change", () => {
      const dev = encodeURIComponent(sel.value);
      previews[idx].src = dev
        ? `/hwcapture/stream?device=${dev}&width=320&height=240&fps=10`
        : "";
    });
  });

  // 3) Start/Stop both recordings
  btn.addEventListener("click", () => {
    if (!selects.every(sel => sel.value)) {
      alert("Select a device for each camera before starting recording.");
      return;
    }
    btn.disabled = true; // prevent double clicks
    if (!recording) {
      // START
      Promise.all(
        selects.map((sel, idx) =>
          fetch("/hwcapture/record/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              device: sel.value,
              output: `cam${idx + 1}.mp4`
            })
          })
        )
      )
      .then((results) => {
        if (results.some(r => !r.ok)) throw new Error("Failed to start one or more recordings");
        recording = true;
        btn.textContent = "⏹ Stop both";
        btn.classList.add("recording");
      })
      .catch((err) => {
        alert("Could not start recording: " + err.message);
        console.error("live-preview.js:", err);
      })
      .finally(() => {
        btn.disabled = false;
      });
    } else {
      // STOP
      Promise.all(
        selects.map((sel) =>
          fetch("/hwcapture/record/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: sel.value })
          })
        )
      )
      .then((results) => {
        if (results.some(r => !r.ok)) throw new Error("Failed to stop one or more recordings");
        recording = false;
        btn.textContent = "▶ Start both";
        btn.classList.remove("recording");
      })
      .catch((err) => {
        alert("Could not stop recording: " + err.message);
        console.error("live-preview.js:", err);
      })
      .finally(() => {
        btn.disabled = false;
      });
    }
  });
});