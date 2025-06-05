const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const API_KEY = "pat_23ZdxQxZJuzmiPz9DBiCRKF3mofez29NBktiO2BzD83VfzwY1qARC7UMAqnTfEPd";
const DATASET_ID = "7506922150122438683";

async function deleteExistingDocs() {
  try {
    const listRes = await axios.post(
      "https://api.coze.cn/open_api/knowledge/document/list",
      { dataset_id: DATASET_ID, page: 0, size: 10 },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "Agw-Js-Conv": "str"
        }
      }
    );

    const docs = listRes.data.document_infos || [];
    if (docs.length === 0) return;

    const ids = docs.map(d => d.document_id);
    console.log("🗑️ 删除文档：", ids);

    await axios.post(
      "https://api.coze.cn/open_api/knowledge/document/delete",
      { document_ids: ids },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "Agw-Js-Conv": "str"
        }
      }
    );
    console.log("✅ 删除完成");
  } catch (e) {
    console.error("❌ 删除失败", e.response?.data || e.message);
  }
}

app.post("/upload", upload.single("file"), async (req, res) => {
  const { password } = req.body;
  const file = req.file;

  if (password !== "12345") {
    return res.status(403).json({ message: "密码错误" });
  }

  try {
    await deleteExistingDocs();

    const base64 = fs.readFileSync(file.path).toString("base64");
    const requestBody = {
      dataset_id: DATASET_ID,
      document_bases: [
        {
          name: file.originalname,
          source_info: {
            document_source: 0,
            file_base64: base64,
            file_type: "pdf"
          }
        }
      ],
      chunk_strategy: {
        separator: "\n\n",
        max_tokens: 800,
        remove_extra_spaces: false,
        remove_urls_emails: false,
        chunk_type: 0
      }
    };

    const result = await axios.post(
      "https://api.coze.cn/open_api/knowledge/document/create",
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "Agw-Js-Conv": "str"
        }
      }
    );

    if (result.data.code === 0) {
      const stream = fs.createReadStream(file.path);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${file.originalname}`);
      stream.pipe(res);
    } else {
      res.status(500).json({ message: "上传失败：" + result.data.msg });
    }
  } catch (e) {
    res.status(500).json({ message: e.response?.data || e.message });
  } finally {
    setTimeout(() => fs.unlink(file.path, () => {}), 3000);
  }
});

app.listen(3000, () => {
  console.log("✅ 服务器已启动：http://localhost:3000/course_editor.html");
});
