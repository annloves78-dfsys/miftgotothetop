import os
import json
import urllib.request

def main():
    files = {
        "sandbox.config.json": {
            "content": "{\n  \"template\": \"node\"\n}"
        }
    }

    # read root files
    for filename in ["package.json", "server.js"]:
        filepath = os.path.join(os.path.dirname(__file__), filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                files[filename] = {"content": f.read()}

    # read public root files
    public_dir = os.path.join(os.path.dirname(__file__), "public")
    for filename in ["index.html", "style.css"]:
        filepath = os.path.join(public_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                files[f"public/{filename}"] = {"content": f.read()}

    # read public js files
    js_dir = os.path.join(public_dir, "js")
    if os.path.exists(js_dir):
        for filename in os.listdir(js_dir):
            if filename.endswith(".js"):
                filepath = os.path.join(js_dir, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    files[f"public/js/{filename}"] = {"content": f.read()}

    data = json.dumps({"files": files}).encode('utf-8')
    req = urllib.request.Request("https://codesandbox.io/api/v1/sandboxes/define?json=1", data=data)
    req.add_header('Content-Type', 'application/json')
    req.add_header('Accept', 'application/json')

    try:
        response = urllib.request.urlopen(req)
        res_data = json.loads(response.read().decode('utf-8'))
        sandbox_id = res_data.get('sandbox_id')
        print("SUCCESS")
        print(f"Editor URL: https://codesandbox.io/s/{sandbox_id}")
        print(f"Live URL: https://{sandbox_id}.csb.app/")
    except Exception as e:
        print("ERROR")
        print(e)
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))

if __name__ == "__main__":
    main()
