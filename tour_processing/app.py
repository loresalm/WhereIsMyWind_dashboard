from flask import Flask, render_template, request, jsonify
import pandas as pd
import os
import json

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TRACK_FILE = os.path.join(BASE_DIR, "data/outputs/all_sailing_performance_clean.csv")
MARKS_FILE = os.path.join(BASE_DIR, "marks.json")

df = pd.read_csv(TRACK_FILE)

tours = sorted(df["gpx_path"].unique())


def load_marks():
    if not os.path.exists(MARKS_FILE):
        return {}
    with open(MARKS_FILE) as f:
        return json.load(f)


def save_marks(data):
    with open(MARKS_FILE, "w") as f:
        json.dump(data, f, indent=2)


@app.route("/")
def index():
    return render_template("index.html", tours=tours)


@app.route("/get_track/<path:tour>")
def get_track(tour):
    subset = df[df["gpx_path"] == tour]

    points = subset[["lat", "lon"]].values.tolist()

    marks = load_marks().get(tour, [])

    return jsonify({
        "points": points,
        "marks": marks
    })


@app.route("/save_mark", methods=["POST"])
def save_mark():
    data = request.json
    tour = data["tour"]

    mark = {
        "lat": data["lat"],
        "lon": data["lon"],
        "label": data["label"]
    }

    marks = load_marks()

    if tour not in marks:
        marks[tour] = []

    marks[tour].append(mark)

    save_marks(marks)

    return jsonify({"status": "ok"})


@app.route("/delete_mark", methods=["POST"])
def delete_mark():
    data = request.json
    tour = data["tour"]
    label = data["label"]

    marks = load_marks()

    if tour in marks:
        marks[tour] = [m for m in marks[tour] if m["label"] != label]

    save_marks(marks)

    return jsonify({"status": "ok"})



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
