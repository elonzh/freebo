// Kept in the bundle so packaged builds do not depend on a writable script file.
// MPC protocol: clsid2/mpc-hc src/mpc-hc/MpcApi.h; PotPlayer: WM_USER API.
export const windowsNativeSource = String.raw`
using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

public class FreeboNative : NativeWindow {
  [StructLayout(LayoutKind.Sequential)] struct CopyData { public IntPtr code; public int size; public IntPtr data; }
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int left, top, right, bottom; }
  delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out Rect rect);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int command);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
  static JavaScriptSerializer json = new JavaScriptSerializer();
  ConcurrentQueue<string> requests = new ConcurrentQueue<string>();
  uint pid; IntPtr target;
  bool loaded, paused, ended, stopped; double duration, position;
  static void Output(object value) { Console.WriteLine(json.Serialize(value)); Console.Out.Flush(); }
  static double Number(string value) { double n; return Double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out n) ? n : 0; }
  static IntPtr Pointer(long value) { return IntPtr.Size == 8 ? new IntPtr(value) : new IntPtr(unchecked((int)value)); }
  bool Owned(IntPtr h) { uint p; GetWindowThreadProcessId(h, out p); return p == pid && pid != 0; }
  IntPtr Find() {
    if (target != IntPtr.Zero && IsWindow(target) && Owned(target)) return target;
    IntPtr found = IntPtr.Zero; long largest = 0;
    EnumWindows(delegate(IntPtr h, IntPtr p) { Rect rect; if (Owned(h) && IsWindowVisible(h) && GetWindowRect(h, out rect)) { long area = (long)(rect.right - rect.left) * (rect.bottom - rect.top); if (area > largest) { largest = area; found = h; } } return true; }, IntPtr.Zero);
    return found;
  }
  long Send(uint msg, long w, long l) {
    IntPtr result; IntPtr h = Find();
    if (h == IntPtr.Zero) throw new Exception("window unavailable");
    if (SendMessageTimeout(h, msg, Pointer(w), Pointer(l), 2, 800, out result) == IntPtr.Zero) throw new Exception("player response timed out");
    return result.ToInt64();
  }
  void Mpc(long command, string value) {
    IntPtr data = Marshal.StringToHGlobalUni(value);
    IntPtr ptr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(CopyData)));
    try {
      Marshal.StructureToPtr(new CopyData { code = Pointer(command), size = (value.Length + 1) * 2, data = data }, ptr, false);
      Send(0x4A, Handle.ToInt64(), ptr.ToInt64());
    } finally { Marshal.FreeHGlobal(ptr); Marshal.FreeHGlobal(data); }
  }
  protected override void WndProc(ref Message m) {
    if (m.Msg == 0x4A && Owned(m.WParam)) {
      CopyData data = (CopyData)Marshal.PtrToStructure(m.LParam, typeof(CopyData));
      if (data.size > 0 && data.size <= 65536 && data.size % 2 == 0) {
        string value = Marshal.PtrToStringUni(data.data, data.size / 2).TrimEnd('\0');
        long code = data.code.ToInt64();
        if (code == 0x50000000) target = m.WParam;
        if (code == 0x50000001) loaded = value == "2";
        if (code == 0x50000002) { paused = value == "1"; stopped = value == "2"; }
        if (code == 0x50000003) { string[] parts = value.Split('|'); duration = Number(parts[parts.Length - 1]); loaded = duration > 0; }
        if (code == 0x50000007 || code == 0x50000008) position = Number(value);
        if (code == 0x50000009) ended = true;
      }
      m.Result = new IntPtr(1); return;
    }
    base.WndProc(ref m);
  }
  void Request(string line) {
    Dictionary<string, object> r = json.Deserialize<Dictionary<string, object>>(line);
    object id = r["id"];
    try {
      string action = (string)r["action"]; object result = true;
      if (action == "target") { pid = Convert.ToUInt32(r["pid"]); target = IntPtr.Zero; loaded = paused = ended = stopped = false; duration = position = 0; }
      else if (action == "activate") { IntPtr h = Find(); result = h != IntPtr.Zero; if (h != IntPtr.Zero) { if (IsIconic(h)) ShowWindow(h, 9); result = SetForegroundWindow(h); } }
      else if (action == "pot-status") { duration = Send(0x400, 0x5002, 1) / 1000.0; position = Send(0x400, 0x5004, 1) / 1000.0; long state = Send(0x400, 0x5006, 0); result = new { loaded = duration > 0 && state != -1, position, duration, paused = state == 1, ended = false, stopped = state == -1 }; }
      else if (action == "pot-pause") Send(0x400, 0x5007, 0);
      else if (action == "pot-seek") Send(0x400, 0x5005, Convert.ToInt64(r["value"]));
      else if (action == "pot-stop") Send(0x111, 20002, 0);
      else if (action == "mpc-status") { Mpc(0xA0003002, ""); Mpc(0xA0003004, ""); result = new { loaded, position, duration, paused, ended, stopped }; }
      else if (action == "mpc-pause") Mpc(0xA0000003, "");
      else if (action == "mpc-seek") Mpc(0xA0002000, Convert.ToString(r["value"], CultureInfo.InvariantCulture));
      else if (action == "mpc-audio") Mpc(0xA0002004, Convert.ToString(r["value"], CultureInfo.InvariantCulture));
      else if (action == "mpc-subtitle") Mpc(0xA0002005, Convert.ToString(r["value"], CultureInfo.InvariantCulture));
      else if (action == "mpc-stop") Mpc(0xA0000001, "");
      else throw new Exception("unknown command");
      Output(new { id, result });
    } catch (Exception error) { Output(new { id, error = error.Message }); }
  }
  public static void Run() {
    FreeboNative bridge = new FreeboNative();
    bridge.CreateHandle(new CreateParams());
    Output(new { ready = bridge.Handle.ToInt64().ToString(CultureInfo.InvariantCulture) });
    Thread input = new Thread(delegate() { string line; while ((line = Console.ReadLine()) != null) bridge.requests.Enqueue(line); bridge.requests.Enqueue("exit"); });
    input.IsBackground = true; input.Start();
    var timer = new System.Windows.Forms.Timer(); timer.Interval = 15;
    timer.Tick += delegate { string line; while (bridge.requests.TryDequeue(out line)) { if (line == "exit") { Application.ExitThread(); return; } bridge.Request(line); } };
    timer.Start(); Application.Run(); timer.Dispose(); bridge.DestroyHandle();
  }
}`;
