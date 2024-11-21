
/**
* @param {Element} canvas. The canvas element to create a context from.
* @return {WebGLRenderingContext} The created context.
*/
function setupWebGL(canvas) {
    return WebGLUtils.setupWebGL(canvas);
}


function render(gl, numPoints) {
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, numPoints)
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

function calc_bezier_curve(p0, p1, p2, numSegments) {
    let bezierVertices = [];
    for (let i = 0; i <= numSegments; i++) {
        let t = i / numSegments;
        let x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
        let y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
        bezierVertices.push(vec2(x, y));
    }
    return bezierVertices;
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
    let clearCanvasButton = document.getElementById("clearCanvas");
    let colorMenu = document.getElementById("colorMenu");
    let clearMenu = document.getElementById("clearMenu");
    let switchMode = document.getElementById("modeSelect");

    gl = setupWebGL(canvas);
    let program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // create buffer for points
    let max_verts = 1000
    let index = 0
    let num_points = 0



    let texCodsVerts = [vec2(0, 0), vec2(0.5, 0), vec2(1, 1)]

    let tBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec2"], gl.STATIC_DRAW)

    let a_texCordsLoc = gl.getAttribLocation(program, "a_texCords");
    gl.vertexAttribPointer(a_texCordsLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_texCordsLoc)


    let vBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec2"], gl.STATIC_DRAW)

    let vPosition = gl.getAttribLocation(program, "a_Position");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition)


    let cBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, max_verts * sizeof["vec4"], gl.STATIC_DRAW)

    let vColor = gl.getAttribLocation(program, "a_color");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    let triangleBuffer = []
    let triangleBufferColor = []

    let circleBuffer = []
    let circleBufferColor = []

    let bezierBuffer = []
    let bezierBufferColor = []

    gl.uniform1f(gl.getUniformLocation(program, "u_epsilon"), 0.0)

    function clearCanvas() {
        let color = colors[clearMenu.value]

        num_points = 0
        index = 0
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }



    canvas.addEventListener("click", (e) => {
        let color = colors[colorMenu.value]

        let rec = e.target.getBoundingClientRect()

        mousepos = vec2(2 * (e.clientX - rec.x) / canvas.width - 1, 2 * (canvas.height - (e.clientY - rec.y) - 1) / canvas.height - 1); // get mouse pos in [0, 1.0]
        let point = []
        add_point(point, mousepos, 0.05)

        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(point))

        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec4"], flatten(Array(6).fill(color)))
        index += 6

        switch (switchMode.value) {
            case "1":
                triangleBuffer.push(mousepos)
                triangleBufferColor.push(color)

                if (triangleBuffer.length == 3) {

                    gl.uniform1i(gl.getUniformLocation(program, "curve"), false)
                    index -= 18
                    num_points -= 18

                    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(triangleBuffer))

                    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec4"], flatten(triangleBufferColor))
                    triangleBuffer = []
                    triangleBufferColor = []
                    index += 3
                }

                break;
            case "2":
                circleBuffer.push(mousepos)
                circleBufferColor.push(color)

                if (circleBuffer.length == 2) {
                    gl.uniform1i(gl.getUniformLocation(program, "curve"), false)
                    index -= 12
                    num_points -= 12
                    let radius = distance(circleBuffer[0], circleBuffer[1])
                    let circle = calc_circle_triangle(circleBuffer[0][0], circleBuffer[0][1], radius, 50);

                    let circleColors = Array(circle.length).fill(circleBufferColor[1])
                    for (let i = 0; i < circle.length; i += 3) {
                        circleColors[i] = circleBufferColor[0]
                    }

                    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec4"], flatten(circleColors))

                    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(circle))



                    circleBuffer = []
                    circleBufferColor = []
                    index += circle.length
                }

                break;
            case "3":
                bezierBuffer.push(mousepos)
                bezierBufferColor.push(color)

                if (bezierBuffer.length == 3) {
                    index -= 18
                    num_points -= 18
                    
                    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(texCodsVerts))

                    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec2"], flatten(bezierBuffer))

                    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer)
                    gl.bufferSubData(gl.ARRAY_BUFFER, index * sizeof["vec4"], flatten(bezierBufferColor))

                    gl.uniform1i(gl.getUniformLocation(program, "curve"), true)
                    bezierBuffer = []
                    bezierBufferColor = []
                    // index += 3
                    index += 3
                }
                break
            default:
                break;
        }

        // TODO: might still be wrong
        num_points = Math.max(num_points, index)
        if (num_points >= max_verts) {
            clearCanvas()
        }
        // num_points = index 
        index %= max_verts
    })

    // clea canvas butteon event listener
    clearCanvasButton.addEventListener("click", (e) => clearCanvas())


    // draw background
    gl.clearColor(0.3921, 0.5843, 0.9294, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);


    function animate() { render(gl, num_points); requestAnimationFrame(animate) }
    animate();
}