// video/web/static/components/live-preview.js

document.addEventListener("DOMContentLoaded", () => {
  const selects  = Array.from(document.querySelectorAll(".capDev"));
  const previews = Array.from(document.querySelectorAll(".prevImg"));
  const btn      = document.getElementById("startAll");
  let recording  = false;

  // 1) Fetch available devices and populate selects
  fetch("/hwcapture/devices")
    .then((res) => res.json())
    .then((devices) => {
      selects.forEach((sel, idx) => {
        devices.forEach((dev) => {
          const opt = document.createElement("option");
          opt.value = dev.path;
          opt.textContent = `${dev.path} (${dev.width}×${dev.height}@${dev.fps}fps)`;
          sel.appendChild(opt);
        });
        // default to first device
        sel.selectedIndex = 0;
        sel.dispatchEvent(new Event("change"));
      });
    })
    .catch(console.error);

  // 2) On select change, point preview <img> to the MJPEG stream
  selects.forEach((sel, idx) => {
    sel.addEventListener("change", () => {
      const dev = encodeURIComponent(sel.value);
      previews[idx].src = `/hwcapture/stream?device=${dev}&width=320&height=240&fps=10`;
    });
  });

  // 3) Start/Stop both recordings
  btn.addEventListener("click", () => {
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
        .then(() => {
          recording = true;
          btn.textContent = "⏹ Stop both";
          btn.classList.add("recording");
        })
        .catch(console.error);
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
        .then(() => {
          recording = false;
          btn.textContent = "▶ Start both";
          btn.classList.remove("recording");
        })
        .catch(console.error);
    }
  });
});