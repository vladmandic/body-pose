type Angle = { pitch: number, yaw: number, roll: number };
type Vector = [number, number, number];
type Matrix = [number, number, number, number, number, number, number, number, number];

const avg = (v1: Vector, v2: Vector): Vector => [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v1[2] + v2[2]) / 2] as Vector;
const norm = (v: Vector): Vector => { // normalize vector
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  v[0] /= length;
  v[1] /= length;
  v[2] /= length;
  return v;
};
const sub = (a: Vector, b: Vector): Vector => { // vector subtraction (a - b)
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return [x, y, z];
};
const cross = (a: Vector, b: Vector): Vector => { // vector cross product (a x b)
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  return [x, y, z];
};

export const boxMinMax = (topLeft: Vector, topRight: Vector, bottomLeft: Vector, bottomRight: Vector) => [avg(topLeft, topRight), avg(bottomLeft, bottomRight), avg(topLeft, bottomLeft), avg(topRight, bottomRight)];

// euler angles from flat rotation matrix: <https://www.geometrictools.com/Documentation/EulerAngles.pdf>
export const eulerAngle = (r: Matrix): Angle => {
  const [r00, _r01, _r02, r10, r11, r12, r20, r21, r22] = r;
  let thetaX: number;
  let thetaY: number;
  let thetaZ: number;
  if (r10 < 1) { // YZX calculation
    if (r10 > -1) {
      thetaZ = Math.asin(r10);
      thetaY = Math.atan2(-r20, r00);
      thetaX = Math.atan2(-r12, r11);
    } else {
      thetaZ = -Math.PI / 2;
      thetaY = -Math.atan2(r21, r22);
      thetaX = 0;
    }
  } else {
    thetaZ = Math.PI / 2;
    thetaY = Math.atan2(r21, r22);
    thetaX = 0;
  }
  if (Number.isNaN(thetaX)) thetaX = 0;
  if (Number.isNaN(thetaY)) thetaY = 0;
  if (Number.isNaN(thetaZ)) thetaZ = 0;
  return { pitch: 2 * -thetaX, yaw: 2 * -thetaY, roll: 2 * -thetaZ };
};

// rotation Matrix from axis vectors: <http://renderdan.blogspot.com/2006/05/rotation-matrix-from-axis-vectors.html>
export const rotationMatrix = (top: Vector, bottom: Vector, left: Vector, right: Vector): Matrix => {
  const yAxis = norm(sub(bottom, top));
  let xAxis = norm(sub(right, left));
  const zAxis = norm(cross(xAxis, yAxis));
  xAxis = cross(yAxis, zAxis); // adjust xAxis to make sure that all axes are perpendicular to each other

  const matrix: Matrix = [ // 3x3 rotation matrix is flattened to array in row-major order. rotation represented by this matrix is inverted
    xAxis[0], xAxis[1], xAxis[2],
    yAxis[0], yAxis[1], yAxis[2],
    zAxis[0], zAxis[1], zAxis[2],
  ];
  return matrix;
};
