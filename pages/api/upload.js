import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        return res.status(500).json({ error: "Form parse error" });
      }

     const fileData = Array.isArray(files.file)
  ? files.file[0]
  : files.file;

if (!fileData || !fileData.filepath) {
  return res.status(400).json({ error: "File not found or invalid" });
}

const data = new FormData();
data.append("file", fs.createReadStream(fileData.filepath));

      const pinataRes = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
            ...data.getHeaders(),
          },
          body: data,
        }
      );

      const result = await pinataRes.json();

      if (!pinataRes.ok) {
        return res.status(500).json({ error: result });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
}