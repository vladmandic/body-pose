/** Vector Math class. */
export default class Vector {
  public x: number;
  public y: number;
  public z: number;

  // constructor
  constructor(a?: number[] | Record<'x' | 'y' | 'z', number> | number | Vector, b?: number, c?: number) {
    if (Array.isArray(a)) {
      this.x = a[0] ?? 0;
      this.y = a[1] ?? 0;
      this.z = a[2] ?? 0;
    } else if (!!a && typeof a === 'object') {
      this.x = a.x ?? 0;
      this.y = a.y ?? 0;
      this.z = a.z ?? 0;
    } else {
      this.x = a ?? 0;
      this.y = b ?? 0;
      this.z = c ?? 0;
    }
  }

  // methods
  negative() {
    return new Vector(-this.x, -this.y, -this.z);
  }
  add(v: Vector | number) {
    if (v instanceof Vector) return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
    return new Vector(this.x + v, this.y + v, this.z + v);
  }
  subtract(v: Vector | number) {
    if (v instanceof Vector) return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
    return new Vector(this.x - v, this.y - v, this.z - v);
  }
  multiply(v: Vector | number) {
    if (v instanceof Vector) return new Vector(this.x * v.x, this.y * v.y, this.z * v.z);
    return new Vector(this.x * v, this.y * v, this.z * v);
  }
  divide(v: Vector | number) {
    if (v instanceof Vector) return new Vector(this.x / v.x, this.y / v.y, this.z / v.z);
    return new Vector(this.x / v, this.y / v, this.z / v);
  }
  equals(v: Vector) {
    return this.x === v.x && this.y === v.y && this.z === v.z;
  }
  dot(v: Vector) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v: Vector) {
    return new Vector(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
  }
  length() {
    return Math.sqrt(this.dot(this));
  }
  distance(v: Vector, d: 2 | 3 = 3) {
    if (d === 2) return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); // 2D distance
    return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2); // 3D distance
  }
  lerp(v: Vector, fraction: number) {
    return v.subtract(this).multiply(fraction).add(this);
  }
  unit() {
    return this.divide(this.length());
  }
  min() {
    return Math.min(Math.min(this.x, this.y), this.z);
  }
  max() {
    return Math.max(Math.max(this.x, this.y), this.z);
  }
  toAngles() {
    return {
      theta: Math.atan2(this.z, this.x),
      phi: Math.asin(this.y / this.length()),
    };
  }
  angleTo(a: Vector) {
    return Math.acos(this.dot(a) / (this.length() * a.length()));
  }
  toArray(n: number) {
    return [this.x, this.y, this.z].slice(0, n || 3);
  }
  clone() {
    return new Vector(this.x, this.y, this.z);
  }
  init(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  // static methods //
  static negative(a: Vector, b: Vector = new Vector()) {
    b.x = -a.x;
    b.y = -a.y;
    b.z = -a.z;
    return b;
  }
  static add(a: Vector, b: Vector | number, c: Vector = new Vector()) {
    if (b instanceof Vector) {
      c.x = a.x + b.x;
      c.y = a.y + b.y;
      c.z = a.z + b.z;
    } else {
      c.x = a.x + b;
      c.y = a.y + b;
      c.z = a.z + b;
    }
    return c;
  }
  static subtract(a: Vector, b: Vector | number, c: Vector = new Vector()) {
    if (b instanceof Vector) {
      c.x = a.x - b.x;
      c.y = a.y - b.y;
      c.z = a.z - b.z;
    } else {
      c.x = a.x - b;
      c.y = a.y - b;
      c.z = a.z - b;
    }
    return c;
  }
  static multiply(a: Vector, b: Vector | number, c: Vector = new Vector()) {
    if (b instanceof Vector) {
      c.x = a.x * b.x;
      c.y = a.y * b.y;
      c.z = a.z * b.z;
    } else {
      c.x = a.x * b;
      c.y = a.y * b;
      c.z = a.z * b;
    }
    return c;
  }
  static divide(a: Vector, b: Vector | number, c: Vector = new Vector()) {
    if (b instanceof Vector) {
      c.x = a.x / b.x;
      c.y = a.y / b.y;
      c.z = a.z / b.z;
    } else {
      c.x = a.x / b;
      c.y = a.y / b;
      c.z = a.z / b;
    }
    return c;
  }
  static cross(a: Vector, b: Vector, c: Vector = new Vector()) {
    c.x = a.y * b.z - a.z * b.y;
    c.y = a.z * b.x - a.x * b.z;
    c.z = a.x * b.y - a.y * b.x;
    return c;
  }
  static unit(a: Vector, b: Vector) {
    const length = a.length();
    b.x = a.x / length;
    b.y = a.y / length;
    b.z = a.z / length;
    return b;
  }
  static fromAngles(theta: number, phi: number) {
    return new Vector(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi));
  }
  static randomDirection() {
    return Vector.fromAngles(Math.random() * Math.PI * 2, Math.asin(Math.random() * 2 - 1));
  }
  static min(a: Vector, b: Vector) {
    return new Vector(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
  }
  static max(a: Vector, b: Vector) {
    return new Vector(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
  }
  static lerp<T extends number | Vector>(a: T, b: T, fraction: number): T {
    if (b instanceof Vector) return b.subtract(a).multiply(fraction).add(a) as unknown as T;
    return (((b as number) - (a as number)) * fraction + (a as unknown as number)) as unknown as T;
  }
  static fromArray(a: Array<number>) {
    return new Vector(a[0], a[1], a[2]);
  }
  static angleBetween(a: Vector, b: Vector) {
    return a.angleTo(b);
  }
  static angleBetweenVertices(a: Vector, b: Vector, c: Vector) {
    const ab = a.subtract(b);
    const bc = c.subtract(b);
    return ab.subtract(bc); // this is placeholder
  }
  static distance(a: Vector, b: Vector, d: number) {
    if (d === 2) return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }
  static toDegrees(a: number) {
    return a * (180 / Math.PI);
  }
  static normalizeAngle(radians: number) {
    const TWO_PI = Math.PI * 2;
    let angle = radians % TWO_PI;
    // eslint-disable-next-line no-nested-ternary
    angle = angle > Math.PI
      ? (angle - TWO_PI)
      : (angle < -Math.PI ? TWO_PI + angle : angle);
    return angle / Math.PI;
  }
  static normalizeRadians(radians: number) {
    if (radians >= Math.PI / 2) {
      radians -= 2 * Math.PI;
    }
    if (radians <= -Math.PI / 2) {
      radians += 2 * Math.PI;
      radians = Math.PI - radians;
    }
    return radians / Math.PI;
  }
  static find2DAngle(cx: number, cy: number, ex: number, ey: number) {
    const dy = ey - cy;
    const dx = ex - cx;
    const theta = Math.atan2(dy, dx);
    return theta;
  }
  static findRotation(a: Vector, b: Vector, normalize = true) {
    if (normalize) {
      return new Vector(
        Vector.normalizeRadians(Vector.find2DAngle(a.z, a.x, b.z, b.x)),
        Vector.normalizeRadians(Vector.find2DAngle(a.z, a.y, b.z, b.y)),
        Vector.normalizeRadians(Vector.find2DAngle(a.x, a.y, b.x, b.y)),
      );
    }
    return new Vector(
      Vector.find2DAngle(a.z, a.x, b.z, b.x),
      Vector.find2DAngle(a.z, a.y, b.z, b.y),
      Vector.find2DAngle(a.x, a.y, b.x, b.y),
    );
  }
  static rollPitchYaw(a: Vector, b: Vector, c?: Vector) {
    if (!c) {
      return new Vector(
        Vector.normalizeAngle(Vector.find2DAngle(a.z, a.y, b.z, b.y)),
        Vector.normalizeAngle(Vector.find2DAngle(a.z, a.x, b.z, b.x)),
        Vector.normalizeAngle(Vector.find2DAngle(a.x, a.y, b.x, b.y)),
      );
    }
    const qb = (b as Vector).subtract(a as Vector);
    const qc = c.subtract(a as Vector);
    const n = qb.cross(qc);
    const unitZ = n.unit();
    const unitX = qb.unit();
    const unitY = unitZ.cross(unitX);
    const beta = Math.asin(unitZ.x) || 0;
    const alpha = Math.atan2(-unitZ.y, unitZ.z) || 0;
    const gamma = Math.atan2(-unitY.x, unitX.x) || 0;
    return new Vector(
      Vector.normalizeAngle(alpha),
      Vector.normalizeAngle(beta),
      Vector.normalizeAngle(gamma),
    );
  }
  static angleBetween3DCoords(a: Vector | Record<'x' | 'y' | 'z', number>, b: Vector | Record<'x' | 'y' | 'z', number>, c: Vector | Record<'x' | 'y' | 'z', number>) {
    if (!(a instanceof Vector)) {
      a = new Vector(a);
      b = new Vector(b);
      c = new Vector(c);
    }
    const v1 = (a as Vector).subtract(b as Vector);
    const v2 = (c as Vector).subtract(b as Vector);
    const v1norm = v1.unit();
    const v2norm = v2.unit();
    const dotProducts = v1norm.dot(v2norm);
    const angle = Math.acos(dotProducts);
    return Vector.normalizeRadians(angle);
  }
}
