
// Need Authentication storage, follow solution: 
// https://stackoverflow.com/questions/42043611/could-not-load-the-default-credentials-node-js-google-compute-engine-tutorial

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const { Storage } = require('@google-cloud/storage');

const app = express();
const upload = multer({ dest: 'uploads/' });
const bucketName = 'm3u8-bucket';
const storage = new Storage({
  projectId: 'implement-m3u8',
});
let idVideo = 2;
const listQualitiesVideo = ['1080', '720', '480', '360'];

// Express routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Upload video mp4
// app.post('/upload', upload.single('video'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).send('No file uploaded.');
//     }

//     // Upload the file to Google Cloud Storage
//     const bucket = storage.bucket(bucketName);
//     const gcsFileName = `videos/${req.file.originalname}`;
//     await bucket.upload(req.file.path, {
//       destination: gcsFileName,
//     });

//     res.status(200).send('File uploaded successfully.');
//   } catch (err) {
//     console.error('Error:', err);
//     res.status(500).send('An error occurred.');
//   }
// });

// Convert mp4 to m3u8
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const videoPath = req.file.path;
    const outputFolder = `encode-video/video-${idVideo}`;

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const outputFilePath = `${outputFolder}/video_m3u8.m3u8`;

    // Convert MP4 to M3U8 using ffmpeg
    ffmpeg(videoPath)
    .outputOptions([
      '-b:v 1M', // Bitrate for video (1 Mbps in this case)
      '-g 60',   // GOP size (keyframe interval) in frames
      '-hls_time 2',       // Segment duration in seconds
      '-hls_list_size 0',  // Set to 0 to keep all segments in the playlist
    ])
    .output(outputFilePath)
    .on('start', (command) => console.log('Start:', command))
    .on('end', async () => {
      const bucket = storage.bucket(bucketName);
      const files = fs.readdirSync(outputFolder);

      // Upload each file to the bucket
      for (const file of files) {
        console.log(file)
        const filePath = path.join(outputFolder, file);
        const destinationPath = `video/${idVideo}/${file}`;
  
        await bucket.upload(filePath, {
          destination: destinationPath,
        });
        console.log(`File "${file}" uploaded to "video" folder.`);
      }
      deleteLocalFolder(outputFolder);
      console.log('All files uploaded to the "video" folder successfully.');
      res.status(200).send('Done');
    })
    .on('error', (err) => console.error('Error during HLS conversion:', err.message))
    .run();
    
  } catch (err) {
    res.status(500).send('An error occurred.');
  }
});

const deleteLocalFolder = (folderPath) => {
  try {
    fs.rmdirSync(folderPath, { recursive: true });
    console.log(`Local folder "${folderPath}" deleted successfully.`);
  } catch (err) {
    console.error('Error deleting local folder:', err);
  }
};

// Start the server
const port = 4000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
