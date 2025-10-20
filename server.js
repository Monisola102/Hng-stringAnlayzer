require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());


let analyzedStrings = [];


function analyzeString(value) {
  const cleanValue = value.trim();
  const words = cleanValue.split(/\s+/).filter(Boolean);
  const isPalindrome = cleanValue.toLowerCase().replace(/\s+/g, "") === cleanValue.toLowerCase().replace(/\s+/g, "").split("").reverse().join("");
  const uniqueChars = new Set(cleanValue.replace(/\s+/g, "")).size;
  const sha256Hash = crypto.createHash("sha256").update(cleanValue).digest("hex");

  const frequencyMap = {};
  for (let char of cleanValue) {
    if (char !== " ") {
      frequencyMap[char] = (frequencyMap[char] || 0) + 1;
    }
  }

  return {
    id: sha256Hash,
    value: cleanValue,
    properties: {
      length: cleanValue.length,
      is_palindrome: isPalindrome,
      unique_characters: uniqueChars,
      word_count: words.length,
      sha256_hash: sha256Hash,
      character_frequency_map: frequencyMap
    },
    created_at: new Date().toISOString()
  };
}

app.post("/strings", (req, res) => {
  const { value } = req.body;

  if (!value) {
    return res.status(400).json({ error: "Invalid request body or missing 'value' field." });
  }

  if (typeof value !== "string") {
    return res.status(422).json({ error: "Invalid data type for 'value' (must be string)." });
  }

  const exists = analyzedStrings.find(item => item.value === value);
  if (exists) {
    return res.status(409).json({ error: "String already exists in the system." });
  }

  const result = analyzeString(value);
  analyzedStrings.push(result);
  res.status(201).json(result);
});

app.get("/strings/:string_value", (req, res) => {
  const { string_value } = req.params;
  const found = analyzedStrings.find(item => item.value === string_value);
  if (!found) {
    return res.status(404).json({ error: "String does not exist in the system." });
  }
  res.json(found);
});

app.get("/strings", (req, res) => {
  let results = [...analyzedStrings];
  const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;

  try {
    if (is_palindrome) {
      const boolVal = is_palindrome === "true";
      results = results.filter(item => item.properties.is_palindrome === boolVal);
    }
    if (min_length) {
      results = results.filter(item => item.properties.length >= parseInt(min_length));
    }
    if (max_length) {
      results = results.filter(item => item.properties.length <= parseInt(max_length));
    }
    if (word_count) {
      results = results.filter(item => item.properties.word_count === parseInt(word_count));
    }
    if (contains_character) {
      results = results.filter(item => item.value.includes(contains_character));
    }

    res.json({
      data: results,
      count: results.length,
      filters_applied: req.query
    });
  } catch (err) {
    res.status(400).json({ error: "Invalid query parameter values or types." });
  }
});

app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;

  if (!query) return res.status(400).json({ error: "Missing query parameter." });

  let filters = {};

  if (query.includes("single word")) filters.word_count = 1;
  if (query.includes("palindromic")) filters.is_palindrome = true;
  if (query.includes("longer than")) {
    const match = query.match(/longer than (\d+)/);
    if (match) filters.min_length = parseInt(match[1]) + 1;
  }
  if (query.includes("containing the letter")) {
    const match = query.match(/letter (\w)/);
    if (match) filters.contains_character = match[1];
  }

  if (Object.keys(filters).length === 0) {
    return res.status(400).json({ error: "Unable to parse natural language query." });
  }

  let filtered = [...analyzedStrings];
  if (filters.word_count)
    filtered = filtered.filter(i => i.properties.word_count === filters.word_count);
  if (filters.is_palindrome)
    filtered = filtered.filter(i => i.properties.is_palindrome);
  if (filters.min_length)
    filtered = filtered.filter(i => i.properties.length >= filters.min_length);
  if (filters.contains_character)
    filtered = filtered.filter(i => i.value.includes(filters.contains_character));

  res.json({
    data: filtered,
    count: filtered.length,
    interpreted_query: {
      original: query,
      parsed_filters: filters
    }
  });
});

app.delete("/strings/:string_value", (req, res) => {
  const { string_value } = req.params;
  const index = analyzedStrings.findIndex(item => item.value === string_value);
  if (index === -1) {
    return res.status(404).json({ error: "String does not exist in the system." });
  }
  analyzedStrings.splice(index, 1);
  res.status(204).send();
});

app.get("/", (req, res) => {
  res.send("Welcome to the String Analysis API!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
