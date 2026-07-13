// Guarda este archivo como e3d_reader.mjs
function YV(value) {
    return value & 255;
}

function qV(value) {
    return (value >> 8) & 255;
}
class Bvt {
    constructor(url, authorizationToken) {
        this._url = url;
        this._authorizationToken = authorizationToken;
        this._buffer = null;
        this._filePos = 0;
        this._formatVersion = 0;
    }

    async loadSceneData() {
        const options = {
            headers: new Headers({
                'Authorization': `Bearer PAT:${this._authorizationToken}`
            })
        };

        try {
            console.log(`Fetching data from ${this._url}`);
            const response = await fetch(this._url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
            }
            
            this._buffer = await response.arrayBuffer();
            console.log(`Received buffer of size: ${this._buffer.byteLength} bytes`);
            
            this._filePos = 0;
            this._formatVersion = this._loadByte();
            console.log(`E3D format version: ${this._formatVersion}`);

            if (this._formatVersion > 4) {
                throw new Error(`Unsupported E3D model format version: ${this._formatVersion}`);
            }

            const sceneData = {
                view: {
                    modelTransform: this._loadTransform(),
                    viewBox: this._loadVector(),
                    viewColors: {
                        top: this._loadColor(),
                        bottom: this._loadColor()
                    }
                }
            };

            const loadArray = (loader) => {
                const count = this._loadLong();
                return Array.from({ length: count }, () => loader.call(this));
            };

            sceneData.lights = loadArray(this._loadLight);
            sceneData.textures = loadArray(this._loadTexture);
            sceneData.meshes = loadArray(this._loadMesh);
            sceneData.parts = loadArray(this._loadPart);

            if (this._filePos !== this._buffer.byteLength) {
                throw new Error("Unexpected end of E3D model data");
            }

            return sceneData;
        } catch (error) {
            console.error("Error in loadSceneData:", error);
            throw error;
        }
    }
    _getViewAndAdvance(i) {
        const e = new DataView(this._buffer,this._filePos,i);
        return this._filePos += i,
        e
    }
    _loadByte = () => this._getViewAndAdvance(Uint8Array.BYTES_PER_ELEMENT).getUint8(0);
    _loadShort = () => this._getViewAndAdvance(Int16Array.BYTES_PER_ELEMENT).getInt16(0, !0);
    _loadLong = () => this._getViewAndAdvance(Int32Array.BYTES_PER_ELEMENT).getInt32(0, !0);
    _loadFloat = () => this._getViewAndAdvance(Float32Array.BYTES_PER_ELEMENT).getFloat32(0, !0);
    _loadColor() {
        for (var i = this._getViewAndAdvance(4 * Uint8Array.BYTES_PER_ELEMENT), e = new Float32Array(4), n = 0; n < 4; ++n) {
            var r = i.getUint8(n * Uint8Array.BYTES_PER_ELEMENT);
            e[n] = r / 255
        }
        return e[3] = 1 - e[3],
        e
    }
    _loadVector() {
        var i = this._getViewAndAdvance(3 * Float32Array.BYTES_PER_ELEMENT)
          , e = new Float32Array(3);
        return e[0] = i.getFloat32(0 * Float32Array.BYTES_PER_ELEMENT, !0),
        e[1] = i.getFloat32(1 * Float32Array.BYTES_PER_ELEMENT, !0),
        e[2] = i.getFloat32(2 * Float32Array.BYTES_PER_ELEMENT, !0),
        e
    }
    _loadFloatBuffer() {
        for (var i = this._getViewAndAdvance(this._loadLong()), e = i.byteLength / Float32Array.BYTES_PER_ELEMENT, n = new Float32Array(e), r = 0; r < e; ++r)
            n[r] = i.getFloat32(r * Float32Array.BYTES_PER_ELEMENT, !0);
        return n
    }
    _loadShortBuffer() {
        for (var i = this._getViewAndAdvance(this._loadLong()), e = i.byteLength / Uint16Array.BYTES_PER_ELEMENT, n = new Uint16Array(e), r = 0; r < e; ++r)
            n[r] = i.getUint8(2 * r * Uint8Array.BYTES_PER_ELEMENT) + 256 * i.getUint8((2 * r + 1) * Uint8Array.BYTES_PER_ELEMENT);
        return n
    }
    _loadByteBuffer() {
        for (var i = this._getViewAndAdvance(this._loadLong()), e = new Uint8Array(i.byteLength), n = 0; n < i.byteLength; ++n)
            e[n] = i.getUint8(n * Uint8Array.BYTES_PER_ELEMENT);
        return e
    }
    _loadString() {
        for (var i = this._getViewAndAdvance(this._loadLong()), e = "", n = 0; n < Math.floor(i.byteLength / 2); ++n) {
            const r = i.getUint8(2 * n * Uint8Array.BYTES_PER_ELEMENT) + 256 * i.getUint8((2 * n + 1) * Uint8Array.BYTES_PER_ELEMENT);
            0 != r && (e += String.fromCharCode(r))
        }
        return e
    }
    _loadTransform() {
        const i = this._loadVector()
          , e = this._loadVector()
          , n = this._loadVector()
          , r = this._loadVector();
        return [i[0], i[1], i[2], 0, e[0], e[1], e[2], 0, n[0], n[1], n[2], 0, r[0], r[1], r[2], 1]
    }
    _loadLight() {
        var i = {};
        return i.nLightType = this._loadByte(),
        i.color = this._loadColor(),
        (2 == i.nLightType || 3 == i.nLightType) && (i.position = this._loadVector()),
        (1 == i.nLightType || 3 == i.nLightType) && (i.direction = this._loadVector()),
        3 == i.nLightType && (i.fAngle = this._loadFloat(),
        i.fExponent = this._loadFloat()),
        i
    }
    _loadTexture() {
        var i = {};
        return this._loadByte(),
        i.sWidth = this._loadShort(),
        i.sHeight = this._loadShort(),
        i.nComponents = 4,
        i.nSize = i.sWidth * i.sHeight * i.nComponents,
        i.vData = new Uint8Array(this._buffer,this._filePos,i.nSize),
        this._filePos += Uint8Array.BYTES_PER_ELEMENT * i.nSize,
        i
    }
    _loadMaterial() {
        var i = {};
        return i.bColorValid = this._loadByte() > 0,
        i.oColor = this._loadColor(),
        i.nTextureId = this._loadShort(),
        i
    }
    _loadEdgeStyle() {
        var i = {};
        return i.oColor = this._loadColor(),
        i.fLineWidth = this._loadFloat(),
        i.ucLineType = this._loadByte(),
        i
    }
    _loadElements() {
        var i = {
            bCenterValid: !1
        };
        this._formatVersion >= 2 && (i.vCenter = this._loadVector(),
        i.bCenterValid = !0);
        var e = this._loadByte();
        i.mode = ["points", "lineStrip", "lineLoop", "lines", "triangleStrip", "triangleFan", "triangles"][e],
        i.length = this._loadLong();
        var r = this._loadByte();
        return i.type = ["unsignedByte", "unsignedShort"][r],
        i.vArray = "unsignedByte" == i.type ? this._loadByteBuffer() : this._loadShortBuffer(),
        i
    }
    _loadMesh() {
        var i = {
            vertexbuffer: {}
        }
          , e = this._loadByte();
        i.vertexbuffer.bPoints = (1 & e) > 0,
        i.vertexbuffer.bNormals = (2 & e) > 0,
        i.vertexbuffer.bTexCoords = (4 & e) > 0,
        i.vertexbuffer.vArray = this._loadFloatBuffer();
        var n = this._loadLong();
        i.faceElements = new Array(n);
        for (var r = 0; r < n; ++r) {
            var o = {};
            o.material = this._loadMaterial(),
            o.elements = this._loadElements(),
            i.faceElements[r] = o
        }
        var s = this._loadLong();
        for (i.edgeElements = new Array(s),
        r = 0; r < s; ++r) {
            var a = {};
            a.edgestyle = this._loadEdgeStyle(),
            a.elements = this._loadElements(),
            i.edgeElements[r] = a
        }
        return i
    }
    _loadPart() {
        var i = {};
        if (i.nMeshId = this._loadShort(),
        i.oTransform = this._loadTransform(),
        i.oColor = this._loadColor(),
        this._formatVersion >= 3 && (i.nTypeId = this._loadShort(),
        i.nTblObjId = this._loadLong()),
        this._formatVersion >= 4) {
            var e = this._loadLong();
            i.textLines = new Array(e);
            for (var n = 0; n < e; ++n) {
                var r = {};
                r.oTransform = this._loadTransform(),
                r.fHeight = this._loadFloat();
                var o = this._loadShort();
                switch (r.vecTextJust = new Float32Array([0, 0, .1, 1]),
                o) {
                case 2:
                case 5:
                case 8:
                case 11:
                    r.vecTextJust[0] = -.5;
                    break;
                case 3:
                case 6:
                case 9:
                case 12:
                    r.vecTextJust[0] = -1
                }
                switch (o) {
                case 1:
                case 2:
                case 3:
                    r.vecTextJust[1] = -1;
                    break;
                case 4:
                case 5:
                case 6:
                    r.vecTextJust[1] = -.5
                }
                r.strText = this._loadString(),
                i.textLines[n] = r
            }
        }
        return i
    }
}

class ck {
    constructor(renderer) {
        if (!renderer.supportedDataLayouts.includes(1)) {
            throw new Error("Unsupported data layout version: 1. E3dLoader requires a matching Renderer.");
        }
        this._renderer = renderer;
        this._textMaterial = null;
        this._textData = [];
        this._matMap = new Map();
        this._modelOpCount = 0;
        this._modelsLoaded = 0;
        this._rendererOptimized = false;
    }
    async loadE3d(url, options = {}) {
        options.instancingThreshold = options.instancingThreshold || 8;
        options.singleModelViewingMode = options.singleModelViewingMode || false;
    
        this._modelOpCount++;
        if (!options.quietMode) {
            this._renderer.setOverlayState(true, `Loading ${url}...`);
        }
    
        try {
            const sceneData = await new Bvt(url, options.authorizationToken).loadSceneData();
            const partCounts = [];
            sceneData.parts.forEach(part => {
                partCounts[part.nMeshId] = (partCounts[part.nMeshId] || 0) + 1;
            });
    
            if (this._rendererOptimized) {
                console.warn("Renderer fragmentation was already optimized for a model loaded by a previous loadE3d() call!");
            } else if (options.singleModelViewingMode) {
                const instancedMeshes = [];
                if (this._modelsLoaded === 0) {
                    const bufferSizes = [0, 0, 0];
                    for (const part of sceneData.parts) {
                        if (options.skipTypeIds && options.skipTypeIds.includes(part.nTypeId)) continue;
                        bufferSizes[1] += 7 * part.textLines.length * 16;
                        bufferSizes[2] += 12 * part.textLines.length * 28;
                        if (instancedMeshes[part.nMeshId]) continue;
                        const vertexCounts = ck._countMeshVertices(sceneData.meshes[part.nMeshId]);
                        bufferSizes[0] += 20 * vertexCounts.triangle;
                        bufferSizes[1] += 16 * vertexCounts.line + 32;
                        bufferSizes[2] += 28 * vertexCounts.triangleTextured;
                        if (partCounts[part.nMeshId] > options.instancingThreshold) {
                            instancedMeshes[part.nMeshId] = true;
                        }
                    }
                    bufferSizes.forEach((size, index) => {
                        bufferSizes[index] = Math.max(2 ** 23, size);
                    });
                    this._renderer.setBufferFragmentation(bufferSizes);
                    this._rendererOptimized = true;
                } else {
                    console.warn("Other models loaded or loading, cannot optimize for a single model!");
                }
            }
    
            this._modelsLoaded++;
    
            const rootNode = this._renderer.createNode();
            rootNode.name = `E3D: ${url}`;
    
            const transformNode = this._renderer.createNode();
            transformNode.name = "Z-up to Y-up";
            transformNode.matrix = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
            rootNode.addChild(transformNode);
    
            const textureData = sceneData.textures.map(texture => [
                new ImageData(
                    new Uint8ClampedArray(this._swapRedAndBlueChannels(texture.vData)),
                    texture.sWidth,
                    texture.sHeight
                ),
                null
            ]);
    
            const textures = await this._renderer.createTextures(textureData);
            const instancedNodes = [];
    
            for (const part of sceneData.parts) {
                if (options.skipTypeIds && options.skipTypeIds.includes(part.nTypeId)) continue;
    
                let partNode;
                if (instancedNodes[part.nMeshId] == null) {
                    partNode = await this._storeMesh(
                        sceneData.meshes[part.nMeshId],
                        part.oColor,
                        part.oTransform,
                        textures,
                        options.disableTexts ? [] : part.textLines,
                        null
                    );
                    if (partCounts[part.nMeshId] > options.instancingThreshold) {
                        instancedNodes[part.nMeshId] = partNode;
                    }
                } else {
                    partNode = await this._storeMesh(
                        sceneData.meshes[part.nMeshId],
                        part.oColor,
                        part.oTransform,
                        textures,
                        options.disableTexts ? [] : part.textLines,
                        instancedNodes[part.nMeshId]
                    );
                }
    
                partNode.userProperties.set("nTypeId", part.nTypeId);
                partNode.userProperties.set("nTblObjId", part.nTblObjId);
                if (options.nodeTag) {
                    partNode.userProperties.set("tag", options.nodeTag);
                }
                transformNode.addChild(partNode);
            }
    
            if (!options.disableTexts) {
                await this._storeTextData(true);
            }
    
            this._renderer.rootNode.addChild(rootNode);
    
            return rootNode;
        } catch (error) {
            console.error("Error in loadE3d:", error);
            throw error;
        } finally {
            this._modelOpCount--;
            if (this._modelOpCount === 0 && !options.quietMode) {
                this._renderer.setOverlayState(false);
                this._renderer.zoomToVisible();
            }
        }
    }
    _storeMesh(i, e, n, r, o, s) {
        var a = this;
        return y(function*() {
            if (null == s) {
                let tn = function(dn, Fn, Gn, Jn, ur) {
                    Gn = Gn || [1, 0, 0],
                    C[w / 4 + 0] = dn[0],
                    C[w / 4 + 1] = dn[1],
                    C[w / 4 + 2] = dn[2],
                    m[w + 12] = 127 * Gn[0],
                    m[w + 13] = 127 * Gn[1],
                    m[w + 14] = 127 * Gn[2],
                    m[w + 18] = YV(Fn),
                    m[w + 19] = qV(Fn),
                    m[w + 20] = Jn,
                    m[w + 24] = 0,
                    m[w + 25] = ur[0],
                    m[w + 26] = 0,
                    m[w + 27] = 1 - ur[1],
                    w += 28
                }
                  , fn = function(dn, Fn, Gn) {
                    Gn = Gn || [1, 0, 0],
                    l[d / 4 + 0] = dn[0],
                    l[d / 4 + 1] = dn[1],
                    l[d / 4 + 2] = dn[2],
                    c[d + 12] = 127 * Gn[0],
                    c[d + 13] = 127 * Gn[1],
                    c[d + 14] = 127 * Gn[2],
                    c[d + 18] = YV(Fn),
                    c[d + 19] = qV(Fn),
                    d += 20
                }
                  , Bt = function(dn) {
                    T[L / 4 + 0] = dn[0],
                    T[L / 4 + 1] = dn[1],
                    T[L / 4 + 2] = dn[2],
                    L += 16
                }
                  , xe = function(dn, Fn, Gn) {
                    var Jn = [Fn[0] - dn[0], Fn[1] - dn[1], Fn[2] - dn[2]]
                      , ur = [Gn[0] - dn[0], Gn[1] - dn[1], Gn[2] - dn[2]];
                    return (t => {
                        const i = (t => Math.sqrt(t[0] ** 2 + t[1] ** 2 + t[2] ** 2))(t);
                        return 0 == i ? [1, 0, 0] : ( (t, i) => [t[0] * i, t[1] * i, t[2] * i])(t, 1 / i)
                    }
                    )([Jn[1] * ur[2] - Jn[2] * ur[1], Jn[2] * ur[0] - Jn[0] * ur[2], Jn[0] * ur[1] - Jn[1] * ur[0]])
                }
                  , Se = function(dn, Fn, Gn) {
                    if (i.vertexbuffer.bNormals)
                        fn(dn[0], Gn, Fn[0]),
                        fn(dn[1], Gn, Fn[1]),
                        fn(dn[2], Gn, Fn[2]);
                    else {
                        const Jn = xe(dn[0], dn[1], dn[2]);
                        fn(dn[0], Gn, Jn),
                        fn(dn[1], Gn, Jn),
                        fn(dn[2], Gn, Jn)
                    }
                }
                  , pt = function(dn, Fn, Gn, Jn, ur) {
                    if (i.vertexbuffer.bNormals)
                        tn(dn[0], Gn, Fn[0], Jn, ur[0]),
                        tn(dn[1], Gn, Fn[1], Jn, ur[1]),
                        tn(dn[2], Gn, Fn[2], Jn, ur[2]);
                    else {
                        const Ha = xe(dn[0], dn[1], dn[2]);
                        tn(dn[0], Gn, Ha, Jn, ur[0]),
                        tn(dn[1], Gn, Ha, Jn, ur[1]),
                        tn(dn[2], Gn, Ha, Jn, ur[2])
                    }
                }
                  , hn = function(dn) {
                    Qt % 2 != 0 || In[0] == dn[0] && In[1] == dn[1] && In[2] == dn[2] ? In = dn : (Bt([1 / 0, 1 / 0, 1 / 0]),
                    In = [1 / 0, 1 / 0, 1 / 0])
                };
                const Ne = ck._countMeshVertices(i);
                var c = new Uint8Array(20 * Ne.triangle)
                  , l = new Float32Array(c.buffer)
                  , d = 0
                  , m = new Uint8Array(28 * Ne.triangleTextured)
                  , C = new Float32Array(m.buffer)
                  , w = 0
                  , _ = new Uint8Array(16 * Ne.line)
                  , T = new Float32Array(_.buffer)
                  , L = 0
                  , U = 0
                  , q = 3;
                i.vertexbuffer.bPoints && (U += 3),
                i.vertexbuffer.bNormals && (U += 3,
                q += 3),
                i.vertexbuffer.bTexCoords && (U += 2);
                for (var se = 0; se < i.faceElements.length; se++) {
                    var ge, nt = (ue = i.faceElements[se]).material.bColorValid ? ue.material.oColor : e, Xe = ue.material.nTextureId;
                    const dn = nt.join();
                    a._matMap.has(dn) ? ge = a._matMap.get(dn) : (ge = a._renderer.createMaterials([{
                        diffuse: nt
                    }])[0],
                    a._matMap.set(dn, ge));
                    for (var Fe = [[], [], []], Ft = [[], [], []], Nt = [[], [], []], Qt = 0; Qt < ue.elements.length; Qt++) {
                        var an = ue.elements.vArray[Qt];
                        i.vertexbuffer.bPoints && (Fe[Qt % 3][0] = i.vertexbuffer.vArray[U * an + 0],
                        Fe[Qt % 3][1] = i.vertexbuffer.vArray[U * an + 1],
                        Fe[Qt % 3][2] = i.vertexbuffer.vArray[U * an + 2]),
                        i.vertexbuffer.bNormals && (Ft[Qt % 3][0] = i.vertexbuffer.vArray[U * an + 3],
                        Ft[Qt % 3][1] = i.vertexbuffer.vArray[U * an + 4],
                        Ft[Qt % 3][2] = i.vertexbuffer.vArray[U * an + 5]),
                        i.vertexbuffer.bTexCoords && (Nt[Qt % 3][0] = i.vertexbuffer.vArray[U * an + q],
                        Nt[Qt % 3][1] = i.vertexbuffer.vArray[U * an + q + 1]),
                        Qt % 3 == 2 && (i.vertexbuffer.bTexCoords && -1 != Xe ? pt(Fe, Ft, ge, r[Xe], Nt) : Se(Fe, Ft, ge))
                    }
                }
                var In = [-1 / 0, -1 / 0, -1 / 0];
                for (se = 0; se < i.edgeElements.length; se++) {
                    var ue = i.edgeElements[se];
                    for (Qt = 0; Qt < ue.elements.length; Qt++) {
                        var je = [i.vertexbuffer.vArray[U * (an = ue.elements.vArray[Qt]) + 0], i.vertexbuffer.vArray[U * an + 1], i.vertexbuffer.vArray[U * an + 2]];
                        hn(je),
                        Bt(je)
                    }
                }
                L > 0 && hn([1 / 0, 1 / 0, 1 / 0])
            }
            var lt = a._renderer.createNode();
            for (null != n && (lt.matrix = n),
            s ? lt.linkGeometryData(s) : (c = new Uint8Array(c.buffer,0,d),
            _ = new Uint8Array(_.buffer,0,L),
            m = new Uint8Array(m.buffer,0,w),
            lt.assignGeometryData([c, _, m], Ne => Ne, Ne => Ne)),
            Qt = 0; Qt < o.length; Qt++) {
                var We = o[Qt].oTransform;
                We[12] += o[Qt].vecTextJust[0],
                We[13] += o[Qt].vecTextJust[1],
                We[14] += o[Qt].vecTextJust[2];
                var Qe = [.75 * o[Qt].fHeight, 0, 0, 0, 0, .75 * o[Qt].fHeight, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
                yield a._pushTextData(We, Qe, o[Qt].strText, lt)
            }
            return lt
        })()
    }
    static _countMeshVertices(i) {
        var e = i.edgeElements.reduce( (o, s) => o + 3 * s.elements.length, 0);
        const n = i.faceElements.reduce( (o, s) => o + s.elements.length * (-1 != s.material.nTextureId ? 1 : 0), 0);
        return {
            triangle: i.faceElements.reduce( (o, s) => o + s.elements.length, 0) - n,
            line: e,
            triangleTextured: n
        }
    }
    static _renderText(i, e) {
        const r = [1, 32 * e]
          , o = 16 * e;
        var s = document.createElement("canvas");
        s.width = r[0],
        s.height = r[1];
        var a = s.getContext("2d");
        if (!a)
            throw "Error creating CanvasRenderingContext2D!";
        const c = 20 * e;
        a.font = c + "pt Segoe UI";
        var l = {
            x: o,
            y: r[1] / 2 + c / 2
        }
          , d = a.measureText(i);
        return r[0] = Math.ceil(2 * o + d.actualBoundingBoxRight),
        s.width = r[0],
        a.font = c + "pt Segoe UI",
        a.fillStyle = "#003FFF",
        a.fillText(i, l.x, l.y),
        s
    }
    _storeTextData(i) {
        var e = this;
        return y(function*() {
            if (0 != e._textData.length && (i || 8 == e._textData.length)) {
                null == e._textMaterial && (e._textMaterial = e._renderer.createMaterials([{
                    diffuse: [1, 1, 1, 1]
                }]));
                var r = document.createElement("canvas");
                r.width = r.height = 256;
                var o = r.getContext("2d");
                if (!o)
                    throw "Error creating CanvasRenderingContext2D!";
                for (var s = 0; s < e._textData.length; s++) {
                    var a = ck._renderText(e._textData[s].text, 1 * r.width / 256);
                    a.width > r.width ? o.drawImage(a, 0, s * (r.height / 8), r.width, r.height / 8) : o.drawImage(a, 0, s * (r.height / 8)),
                    e._textData[s].innerMatrix[0] *= a.width / a.height,
                    e._textData[s].relWidth = a.width / r.width
                }
                var c = yield e._renderer.createTextures([[r, null]]);
                if (0 != c.length)
                    for (s = 0; s < e._textData.length; s++) {
                        for (var l = e._renderer.createTexturedPlaneGeometryData(), d = 0; d < l[2].length; d += 28) {
                            var m = 256 * l[2][d + 25] + l[2][d + 24];
                            m *= Math.min(1, e._textData[s].relWidth),
                            l[2][d + 24] = YV(m),
                            l[2][d + 25] = qV(m);
                            var C = 256 * l[2][d + 27] + l[2][d + 26];
                            l[2][d + 26] = YV(C = C / 8 + 256 * (7 - s) / 8),
                            l[2][d + 27] = qV(C)
                        }
                        var w = e._renderer.createNode();
                        w.matrix = e._textData[s].matrix;
                        var _ = e._renderer.createNode();
                        _.assignGeometryData(l, e._textMaterial, c),
                        _.matrix = e._textData[s].innerMatrix,
                        w.addChild(_),
                        e._textData[s].node.addChild(w)
                    }
                else
                    console.warn("Unable to allocate texture for text labels!");
                e._textData = []
            }
        })()
    }
    _pushTextData(i, e, n, r) {
        var o = this;
        return y(function*() {
            o._textData.push({
                matrix: i,
                innerMatrix: e,
                text: n,
                node: r
            }),
            yield o._storeTextData()
        })()
    }
}

async function processE3DFile(url, token) {
    try {
        console.log(`Processing file from: ${url}`);
        const bvt = new Bvt(url, token);
        console.log("Bvt instance created");
        
        const sceneData = await bvt.loadSceneData();
        console.log("Scene data loaded successfully");
        console.log("Scene data structure:", JSON.stringify(sceneData, null, 2));
        
        // Instead of processing the data here, we'll return the raw sceneData
        return sceneData;
    } catch (error) {
        console.error('Error processing E3D file:', error);
        throw error;
    }
}

export { processE3DFile, Bvt, ck };
