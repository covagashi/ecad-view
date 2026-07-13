import express from 'express';
import { processE3DFile } from './e3d_reader.mjs';

const app = express();
const port = 3000;

app.use(express.static('public')); // Asumiendo que crearás una carpeta 'public' para archivos estáticos

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

app.get('/process-e3d', async (req, res) => {
    try {
        const url = "https://dataportal.eplan.com/api/download/e3d_data/65921851";
        const token = "D2FE459353F2E1C08B69A5-1";
        const sceneData = await processE3DFile(url, token);
        
        console.log("Received scene data:", JSON.stringify(sceneData, null, 2));
        
        // Extraer vértices y caras del primer mesh
        const vertices = sceneData.meshes[0].vertexbuffer.vArray;
        const faces = sceneData.meshes[0].faceElements.map(fe => fe.elements.vArray);

        console.log("Vertices:", Object.keys(vertices).length);
        console.log("Faces:", faces.length);

        res.json({ vertices, faces });
    } catch (error) {
        console.error('Error processing E3D file:', error);
        res.status(500).json({ error: 'Error processing E3D file', details: error.toString() });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});