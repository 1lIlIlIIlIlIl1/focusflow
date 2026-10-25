#!/usr/bin/env python3
"""把 pomodoro-edge 打包成可分发的 zip。

为什么要单独写这个脚本，而不是直接用 PowerShell 的 Compress-Archive：
Compress-Archive 会把路径存成 Windows 反斜杠（pomodoro-edge\\background.js），
在 macOS / Linux 上解压出来会得到一堆名字里带反斜杠的平铺文件，扩展就加载不了。
zip 规范要求用正斜杠，所以这里手动遍历写入。

用法： python build-zip.py [版本号]
产出： build/zsFocus-v<版本号>.zip
"""

import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pomodoro-edge"
OUT_DIR = ROOT / "build"
VERSION = sys.argv[1] if len(sys.argv) > 1 else "1.0.0"
OUT = OUT_DIR / f"zsFocus-v{VERSION}.zip"

# 不进包的东西：开发笔记、系统垃圾文件
SKIP_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
SKIP_DIRS = {"__pycache__", ".git"}


def collect() -> list[Path]:
    files = []
    for path in sorted(SRC.rglob("*")):
        if path.is_dir():
            continue
        if path.name in SKIP_NAMES:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        files.append(path)
    return files


def main() -> int:
    if not (SRC / "manifest.json").exists():
        print(f"[x] 找不到 {SRC / 'manifest.json'}，是不是目录结构变了？")
        return 1

    OUT_DIR.mkdir(exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    files = collect()
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in files:
            # as_posix() 保证分隔符是 /，跨平台安全
            arcname = path.relative_to(ROOT).as_posix()
            zf.write(path, arcname)

    # 打完立刻回读校验：路径必须全是正斜杠，且 manifest 在包内
    with zipfile.ZipFile(OUT) as zf:
        names = zf.namelist()
        bad = [n for n in names if "\\" in n]
        if bad:
            print(f"[x] 仍有反斜杠路径：{bad[:3]}")
            return 1
        if "pomodoro-edge/manifest.json" not in names:
            print("[x] 包里没有 pomodoro-edge/manifest.json")
            return 1
        print(f"[ok] {OUT.name}  {OUT.stat().st_size / 1024:.1f} KB  {len(names)} 个文件")

    for name in names:
        print(f"     {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
