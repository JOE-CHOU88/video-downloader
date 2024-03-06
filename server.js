const fs = require("fs");
const ytdl = require("ytdl-core");
const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http, {
    transports: ["websocket"],
  });

const port = process.env.PORT || 5000;

let clientGlob = null;

async function handleConnection(client) {
  clientGlob = client;
  console.log("User connected");
  if (clientGlob) {
    clientGlob.emit("connectionSuccess", "You are now connected!");
  }
}

// app.use(cors());

getAudio = (videoURL, res) => {
    console.log(videoURL);
  
    // Function to establish the socket connection
    const establishConnection = () => {
      return new Promise((resolve, reject) => {
        console.log("Start check");
        // Check if the connection is already established
        if (clientGlob) {
          resolve();
        } else {
            console.log("Reconnect");
            // Wait for the connection to be established
            io.on("connection", async (client) => {
                await handleConnection(client);
                resolve();
            });
        }
      });
    };
  
    // Start by establishing the connection
    establishConnection().then(() => {
      // Set headers to indicate an MP3 file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="audio.mp3"`);
  
      // Start the download stream
      var stream = ytdl(videoURL, {
        quality: "highestaudio",
        filter: "audioonly",
      })
        .on("progress", (chunkSize, downloadedChunk, totalChunk) => {
          if (clientGlob) {
            clientGlob.emit("progressEventSocket", [
              (downloadedChunk * 100) / totalChunk,
            ]);
            clientGlob.emit("downloadCompletedServer", [downloadedChunk]);
          } else {
            console.log("clientGlob is still null - cannot emit progress-66");
          }
          if (downloadedChunk == totalChunk) {
            console.log("Downloaded");
          }
        })
        // .pipe(res);
    
        // Create a write stream to save the audio to a file
        const filePath = path.join(__dirname, "media", "audio.mp3");
        var fileStream = fs.createWriteStream(filePath);

        // Pipe the YouTube audio stream to the file
        stream.pipe(fileStream);

        // Pipe the same stream to the response for the client to download
        stream.pipe(res);
  
      // Get video details and emit them
      ytdl.getInfo(videoURL).then((info) => {
        // console.log("all:", info.videoDetails);
        console.log("title:", info.videoDetails.title);
        console.log("uploaded by:", info.videoDetails.author.name);
        console.log("picture:", info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url);
        if (clientGlob) {
          clientGlob.emit("videoDetails", [
            info.videoDetails.title,
            info.videoDetails.author.name,
            info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url
          ]);
        } else {
          console.log("clientGlob is still null - cannot emit video details-84");
        }
      });
    });
  };
app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies
app.use(cors());
app.options('*', cors());  // Enable preflight requests for all routes

//root handler that sends the parameters to getAudio function
app.post("/", (req, res) => {
  getAudio(req.body.url, res);
});

http.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});