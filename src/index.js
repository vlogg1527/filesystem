const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");
const fs = require("fs");
const { v4: uuidv4 } = require('uuid');

const app = express();
const cache = new NodeCache({ stdTTL: 2 * 60 * 60 }); // Cache with 2-hour expiration

// Function to delete old cache keys
function deleteOldCacheKeys() {
  cache.keys((err, keys) => {
    if (!err) {
      const now = Date.now();
      keys.forEach(key => {
        const { created } = cache.getStats(key);
        const timeDifference = now - created;
        if (timeDifference > 2 * 60 * 60 * 1000) { // If older than 2 hours
          cache.del(key);
          console.log("Deleted old cache key:", key);
        }
      });
    }
  });
}

// Schedule deletion of old cache keys every 2 hours
setInterval(deleteOldCacheKeys, 2 * 60 * 60 * 1000);

app.get("/", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("URL parameter is missing");
  }

  // Check if the URL is cached
  const cachedFilePath = cache.get(url);
  if (cachedFilePath) {
    console.log("Using cached result for URL:", url);
    return res.sendFile(cachedFilePath); // Send cached file back to the client
  }

  try {
    // Fetch the image from the URL
    const response = await axios.get(url, { responseType: 'stream' });

    // Generate a unique filename
    const fileName = uuidv4() + ".tmp";
    const filePath = `/tmp/${fileName}`;

    // Cache the file path
    cache.set(url, filePath);

    // Create a write stream to save the file
    const writerStream = fs.createWriteStream(filePath);

    // Pipe the stream from Axios to the write stream
    response.data.pipe(writerStream);

    // When the stream ends, send the file to the client
    response.data.on('end', () => {
      console.log("Streaming completed");
      res.sendFile(filePath);
    });

    // Handle errors during streaming
    writerStream.on('error', (error) => {
      console.error("Error writing file:", error);
      res.status(500).send("Internal Server Error");
    });
  } catch (error) {
    console.error("Error fetching or sending image:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
