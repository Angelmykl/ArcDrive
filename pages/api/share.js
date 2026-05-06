import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "shared.json");

function readData() {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath));
}

function writeData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  if (req.method === "POST") {
    const data = readData();

    data.push(req.body);

    writeData(data);

    return res.status(200).json({ success: true });
  }

  if (req.method === "GET") {
    const { address } = req.query;
    const data = readData();

    const files = data.filter((f) => f.to === address);

    return res.status(200).json({ files });
  }

  res.status(405).end();
}