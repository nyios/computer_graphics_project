
/**
* @param {Element} canvas. The canvas element to create a context from.
* @return {WebGLRenderingContext} The created context.
*/
function setupWebGL(canvas) {
    return WebGLUtils.setupWebGL(canvas);
}


function initAttributeVariable(gl, attribute, buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(attribute, buffer.num, buffer.type, false, 0, 0);
    gl.enableVertexAttribArray(attribute);
}



function add_point(array, point, size) {
    const offset = size / 2;
    let point_coords = [vec2(point[0] - offset, point[1] - offset), vec2(point[0] + offset, point[1] - offset),
    vec2(point[0] - offset, point[1] + offset), vec2(point[0] - offset, point[1] + offset),
    vec2(point[0] + offset, point[1] - offset), vec2(point[0] + offset, point[1] + offset)];
    array.push.apply(array, point_coords);
}

function distance(v1, v2) {
    let dx = v2[0] - v1[0]
    let dy = v2[1] - v1[1]
    return Math.sqrt(dx * dx + dy * dy)
}


// calculate circle coordinates (on cpu)
function calc_circle_triangle(x, y, radius, n) {
    let circle_vertecies = []  // inital circle
    // let circle_vertecies = [vec2(x, y)]  // inital circle
    let prev_vertex = vec2(x, y + radius)
    let vertex
    let x_c, y_c

    for (let i = 1; i <= n; i++) {
        theta = (2 * Math.PI * i) / n
        x_c = radius * Math.sin(theta) + x
        y_c = radius * Math.cos(theta) + y
        vertex = vec2(x_c, y_c)
        circle_vertecies.push(vec2(x, y))
        circle_vertecies.push(prev_vertex)
        circle_vertecies.push(vertex)
        prev_vertex = vertex
    }
    return circle_vertecies
}



window.onload = () => {
    const colors = [
        vec4(0.0, 0.0, 0.0, 1.0),  // Black      -> index 0
        vec4(1.0, 0.0, 0.0, 1.0),  // Red        -> index 1
        vec4(1.0, 1.0, 0.0, 1.0),  // Yellow     -> index 2
        vec4(0.0, 1.0, 0.0, 1.0),  // Green      -> index 3
        vec4(0.0, 0.0, 1.0, 1.0),  // Blue       -> index 4
        vec4(1.0, 0.0, 1.0, 1.0),  // Magenta    -> index 5
        vec4(0.0, 1.0, 1.0, 1.0),  // Cyan       -> index 6
        vec4(0.39, 0.58, 0.93, 1.0) // Cornflower -> index 7
    ];


    let canvas = document.getElementById("c");
    canvas.getContext("webgl", { premultipliedAlpha: false });
    let clearCanvasButton = document.getElementById("clearCanvas");
    let colorMenu = document.getElementById("colorMenu");
    let clearMenu = document.getElementById("clearMenu");
    let switchMode = document.getElementById("modeSelect");
    let lineThickness = document.getElementById("lineThickness");

    gl = setupWebGL(canvas);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.getExtension('OES_standard_derivatives')
    let program = initShaders(gl, "vertex-shader", "fragment-shader");
    let program_bezier = initShaders(gl, "vertex-shader-bezier", "fragment-shader-bezier");

    // create buffer for points
    const max_verts = 10000
    let index = 0
    let index_bezier = 0
    let num_points = 0
    let num_points_bezier = 0


    ///////////////////////
    //  Triangel, Circle, Points
    ///////////////////////
    gl.useProgram(program)

    let vBuffer = gl.createBuffer()
    vBuffer.num = 2
    vBuffer.type = gl.FLOAT
    let vPosition = gl.getAttribLocation(program, "a_Position");
    initAttributeVariable(gl, vPosition, vBuffer)

    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec2"], gl.STATIC_DRAW)

    let cBuffer = gl.createBuffer()
    cBuffer.num = 4
    cBuffer.type = gl.FLOAT
    let vColor = gl.getAttribLocation(program, "a_color");
    initAttributeVariable(gl, vColor, cBuffer)

    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec4"], gl.STATIC_DRAW)

    ///////////////////////
    //      Bezier
    ///////////////////////
    gl.useProgram(program_bezier)

    let texCordsVerts_base = [vec2(0, 0), vec2(0.5, 0), vec2(1, 1)]

    let tBuffer = gl.createBuffer()
    tBuffer.num = 3
    tBuffer.type = gl.FLOAT
    let a_texCordsLoc = gl.getAttribLocation(program_bezier, "a_texCords");
    initAttributeVariable(gl, a_texCordsLoc, tBuffer)

    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec3"], gl.STATIC_DRAW)


    let bezierVertexBuffer = gl.createBuffer()
    bezierVertexBuffer.num = 2
    bezierVertexBuffer.type = gl.FLOAT
    let bezierVertexBufferLoc = gl.getAttribLocation(program_bezier, "a_Position");
    initAttributeVariable(gl, bezierVertexBufferLoc, bezierVertexBuffer)

    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec2"], gl.STATIC_DRAW)

    // color buffer bezier curve
    let bezierColorBuffer = gl.createBuffer()
    bezierColorBuffer.num = 4
    bezierColorBuffer.type = gl.FLOAT
    let bezierColorLoc = gl.getAttribLocation(program_bezier, "a_color");
    initAttributeVariable(gl, bezierColorLoc, bezierColorBuffer)

    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec4"], gl.STATIC_DRAW)

    let triangleBuffer = []
    let triangleBufferColor = []

    let circleBuffer = []
    let circleBufferColor = []

    let bezier = []
    let bezierColor = []

    let drawCalls = []

    function clearCanvas() {
        let color = colors[clearMenu.value]
        drawCalls = []

        num_points = 0
        index = 0
        num_points_bezier = 0
        index_bezier = 0
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function addDrawCall(drawCalls, num_points, program) {
        if(drawCalls.length === 0) {
            drawCalls.push([program, num_points])
            return
        }
        let lastElement = drawCalls[drawCalls.length - 1]
        if (lastElement[0] === program) {
            lastElement[1] += num_points
        } else {
            drawCalls.push([program, num_points])
        }

    }
    function removeDrawCall(drawCalls, num_points, program) {
        if (drawCalls.length === 0) {
            return
        } 
        let lastElement = drawCalls[drawCalls.length - 1]
        if (lastElement[0] === program) {
            if (lastElement[1] === num_points) {
                drawCalls.pop()
                return
            }
            lastElement[1] -= num_points
        }
    }


    canvas.addEventListener("click", (e) => {
        let color = colors[colorMenu.value]

        let rec = e.target.getBoundingClientRect()

        mousepos = vec2(2 * (e.clientX - rec.x) / canvas.width - 1, 2 * (canvas.height - (e.clientY - rec.y) - 1) / canvas.height - 1); // get mouse pos in [0, 1.0]
        let point = []
        add_point(point, mousepos, 0.05)

        gl.useProgram(program)

        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(point))
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec4"], flatten(Array(6).fill(color)))

        index += 6
        addDrawCall(drawCalls, 6, program)

        switch (switchMode.value) {
            case "1":
                triangleBuffer.push(mousepos)
                triangleBufferColor.push(color)

                if (triangleBuffer.length == 3) {

                    index -= 18
                    num_points -= 18
                    removeDrawCall(drawCalls, 18, program)

                    gl.useProgram(program)
                    initAttributeVariable(gl, vPosition, vBuffer)
                    initAttributeVariable(gl, vColor, cBuffer)

                    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(triangleBuffer))

                    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec4"], flatten(triangleBufferColor))

                    triangleBuffer = []
                    triangleBufferColor = []
                    index += 3
                    addDrawCall(drawCalls, 3, program)
                }

                break;
            case "2":
                circleBuffer.push(mousepos)
                circleBufferColor.push(color)

                if (circleBuffer.length == 2) {

                    index -= 12
                    num_points -= 12
                    removeDrawCall(drawCalls, 12, program)

                    let radius = distance(circleBuffer[0], circleBuffer[1])
                    let circle = calc_circle_triangle(circleBuffer[0][0], circleBuffer[0][1], radius, 50);

                    let circleColors = Array(circle.length).fill(circleBufferColor[1])
                    for (let i = 0; i < circle.length; i += 3) {
                        circleColors[i] = circleBufferColor[0]
                    }

                    gl.useProgram(program)
                    initAttributeVariable(gl, vPosition, vBuffer)
                    initAttributeVariable(gl, vColor, cBuffer)

                    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec4"], flatten(circleColors))

                    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(circle))



                    circleBuffer = []
                    circleBufferColor = []
                    index += circle.length
                    addDrawCall(drawCalls, circle.length, program)
                }

                break;
            case "3":
            case "4":
            case "5":
                bezier.push(mousepos)
                bezierColor.push(color)

                if (bezier.length == 3) {
                    index -= 18
                    num_points -= 18
                    removeDrawCall(drawCalls, 18, program)

                    gl.useProgram(program_bezier)

                    let texCordsVerts;

                    if (switchMode.value == "3") {
                        texCordsVerts = texCordsVerts_base.map((vec) => { return vec3(vec[0], vec[1], -1.0) })
                    } else if (switchMode.value == "4") {
                        texCordsVerts = texCordsVerts_base.map((vec) => { return vec3(vec[0], vec[1], 1.0) })
                    } else {
                        texCordsVerts = texCordsVerts_base.map((vec) => { return vec3(vec[0], vec[1], 0.0) })
                    }


                    initAttributeVariable(gl, a_texCordsLoc, tBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index_bezier * sizeof["vec3"], flatten(texCordsVerts))

                    initAttributeVariable(gl, bezierVertexBufferLoc, bezierVertexBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index_bezier * sizeof["vec2"], flatten(bezier))

                    initAttributeVariable(gl, bezierColorLoc, bezierColorBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index_bezier * sizeof["vec4"], flatten(bezierColor))

                    bezier = []
                    bezierColor = []
                    index_bezier += 3
                    addDrawCall(drawCalls, 3, program_bezier)
                }
                break
            default:
                break;
        }

        num_points = Math.max(num_points, index)
        num_points_bezier = Math.max(num_points_bezier, index_bezier)
        if ((num_points + num_points_bezier) >= max_verts) {
            clearCanvas()
        }
        // num_points = index 
        index %= max_verts
    })

    // clear canvas butteon event listener
    clearCanvasButton.addEventListener("click", (e) => clearCanvas())


    // draw background
    gl.clearColor(0.3921, 0.5843, 0.9294, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);


    let totalProgram
    let totalBezier 
    function animate() {

        gl.clear(gl.COLOR_BUFFER_BIT)
        totalBezier = 0
        totalProgram = 0 
        for (let i = 0; i < drawCalls.length; i++) {
            p = drawCalls[i][0]
            num_points = drawCalls[i][1]
            if (p === program) {
                gl.useProgram(program)
                initAttributeVariable(gl, vPosition, vBuffer)
                initAttributeVariable(gl, vColor, cBuffer)
                gl.drawArrays(gl.TRIANGLES, totalProgram, num_points)
                totalProgram += num_points
            } else {
                gl.useProgram(program_bezier)
                initAttributeVariable(gl, a_texCordsLoc, tBuffer)
                initAttributeVariable(gl, bezierVertexBufferLoc, bezierVertexBuffer)
                initAttributeVariable(gl, bezierColorLoc, bezierColorBuffer)
                gl.drawArrays(gl.TRIANGLES, totalBezier, num_points)
                totalBezier += num_points
            }


        }
        requestAnimationFrame(animate)
    }
    animate();
}