import os
import shutil

src_root = r"L:\ClipifyAI"
dests = [
    r"L:\ClipifyAI\build\installer_app\resources\payload",
    r"L:\ClipifyAI\build\installer_app\out\win-unpacked\resources\payload"
]

files_to_copy = ["app.py", "main.py"]
dirs_to_copy = ["static", "templates"]

for d in dests:
    if os.path.isdir(d):
        print(f"Syncing to {d}...")
        for f in files_to_copy:
            src = os.path.join(src_root, f)
            dst = os.path.join(d, f)
            shutil.copy2(src, dst)
            print(f"  Copied {f}")
        for folder in dirs_to_copy:
            src = os.path.join(src_root, folder)
            dst = os.path.join(d, folder)
            shutil.copytree(src, dst, dirs_exist_ok=True)
            print(f"  Synced tree {folder}")
        print(f"Done syncing to {d}")
    else:
        print(f"Skipping missing dir {d}")

print("Payload sync complete.")

