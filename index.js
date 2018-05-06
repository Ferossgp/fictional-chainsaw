const width = window.innerWidth;
const height = window.innerHeight;
const game = new Phaser.Game(width, height, Phaser.CANVAS, 'canvas');

const DiffDrive = function (game) {
    this.car = null;
    this.speed = 100;
    this.right_speed = 100;
    this.left_speed = 100;

    this.wheel_radius = 2.7;
    this.wheel_base = 10.0;
    this.mass = 1000;
    this.damping = 2;
    this.staticFriction = 400;
    this.velocity = 2.0 * Math.PI * this.wheel_radius / 360;
    this.tolerance = 1e-8;

    this.P = 150;
    this.I = 0.1;
    this.D = 15;
    this.I_MAX = 0;

    this.sumError = 0;
    this.lastError = 0;
    this.lastTime = 0

    this.bmd = null;
    this.points = {
        x: [10, 200, 200, 400, 600, 600, 500, 380, 200, 10],
        y: [10, 10, 200, 200, 10, 400, 350, 220, 240, 10]
    };
};

DiffDrive.prototype = {

    init: function () {
        this.physics.startSystem(Phaser.Physics.P2JS);
    },

    preload: function () {

    },

    create: function () {
        this.stage.backgroundColor = '#204090';
        this.bmd = this.add.bitmapData(this.game.width, this.game.height);
        this.bmd.addToWorld();

        this.drawLine();

        //  Enable p2 physics        
        game.physics.startSystem(Phaser.Physics.P2JS);

        this.car = game.add.sprite(width, height);
        this.car.scale.setTo(0.2, 0.2);

        game.physics.p2.enable([this.car]);
        this.car.body.kinematic = true;
        this.car.body.setRectangle(60, 30);
        this.car.body.debug = true;
        this.car.body.mass = this.mass;
        this.car.body.damping = this.damping;
        // Set initial position
        this.car.x = this.points.x[0];
        this.car.y = this.points.y[0];
        this.car.body.x = this.points.x[0];
        this.car.body.y = this.points.y[0];
        this.car.angle = Math.atan2(this.points.y[1] - this.points.y[0], this.points.x[1] - this.points.x[0]) * 180 / Math.PI;
        this.car.body.angle = Math.atan2(this.points.y[1] - this.points.y[0], this.points.x[1] - this.points.x[0]) * 180 / Math.PI;
    },

    drawLine: function () {
        this.bmd.clear();

        const x = 1 / game.width;

        for (let i = 0; i <= 1; i += x) {
            const px = this.math.linearInterpolation(this.points.x, i);
            const py = this.math.linearInterpolation(this.points.y, i);

            this.bmd.rect(px, py, 1, 1, 'rgba(255, 255, 255, 1)');
        }

        for (let p = 0; p < this.points.x.length; p++) {
            this.bmd.rect(this.points.x[p] - 3, this.points.y[p] - 3, 6, 6, 'rgba(255, 0, 0, 1)');
        }
    },


    pid: function (currentValue) {

        let dt;
        let currentTime = Date.now();
        if (this.lastTime === 0) {
            dt = 0;
        } else {
            dt = (currentTime - this.lastTime) / 1000;
        }
        this.lastTime = currentTime;

        if (dt === 0) {
            dt = 1;
        }
        let error = currentValue;
        this.sumError = this.sumError + error * dt;
        if (this.I_MAX > 0 && Math.abs(this.sumError) > this.I_MAX) {
            let sumSign = (this.sumError > 0) ? 1 : -1;
            this.sumError = sumSign * this.I_MAX;
        }

        let dError = (error - this.lastError) / dt;

        this.lastError = error;

        return (this.P * error) + (this.I * this.sumError) + (this.D * dError);
    },
    round: function (number, precision) {
        const shift = function (number, precision) {
            const numArray = ("" + number).split("e");
            return +(numArray[0] + "e" + (numArray[1] ? (+numArray[1] + precision) : precision));
        };
        return shift(Math.round(shift(number, +precision)), -precision);
    },

    getShortestAngle: function (angle1, angle2) {
        const difference = angle2 - angle1;
        if (difference === 0) {
            return 0;
        }
        const times = Math.floor((difference - (-180)) / 360);

        return difference - (times * 360);
    },

    lineSensor: function () {
        const cx = Math.round(this.car.x);
        const cy = Math.round(this.car.y);
        const cangle = this.car.angle;
        const allowed_error = 1;

        let new_angle;

        for (let i = 0; i < this.points.x.length - 1; i++) {
            const x1 = this.points.x[i];
            const y1 = this.points.y[i];

            const x2 = this.points.x[i + 1];
            const y2 = this.points.y[i + 1];
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

            if (this.math.fuzzyEqual(cx, x1) && this.math.fuzzyEqual(cy, y1)) {
                new_angle = angle;
            }
        }
        if (new_angle !== undefined && new_angle !== null) {
            //const rotate = this.pid();
            const rotate = this.getShortestAngle(cangle, new_angle);
            //console.log("Current angle: "+cangle+ " New angle: "+new_angle);
            //console.log(rotate);
            this.left_speed = this.speed - rotate * this.wheel_base / 2.0;
            this.right_speed = this.speed + rotate * this.wheel_base / 2.0;

        } else {
            this.left_speed = this.speed;
            this.left_speed = this.speed;
        }
    },

    move: function () {
        const left = this.velocity * this.left_speed;
        const right = this.velocity * this.right_speed;

        const cx = Math.round(this.car.x);
        const cy = Math.round(this.car.y);

        const cangle = this.car.angle;
        const velocity = {
            x: 0,
            y: 0,
            angle: cangle
        };
        let dt = 1;

        if (Math.abs(left - right) < this.tolerance) {
            this.car.x = this.car.x + left * Math.cos(cangle) * dt;
            this.car.y = this.car.y + left * Math.sin(cangle) * dt;
            this.car.angle = cangle;
            this.car.body.angle = cangle;
            const forward_speed = (left + right) / 2 * 10;
            velocity.x = Math.cos(cangle * Math.PI / 180) * forward_speed;
            velocity.y = Math.sin(cangle * Math.PI / 180) * forward_speed;
        } else {
            const r = (this.wheel_base / 2) * ((right + left) / (right - left));
            const o_dt = dt * (this.right_speed - this.left_speed) / this.wheel_base;
            //console.log("left "+this.left_speed+" right "+this.right_speed + " o_dt " + o_dt);            
            const iccx = cx - r * Math.sin(cangle);
            const iccy = cy + r * Math.cos(cangle);
            const x = Math.cos(o_dt) * (cx - iccx) - Math.sin(o_dt) * (cy - iccy) + iccx;
            const y = Math.sin(o_dt) * (cx - iccx) + Math.cos(o_dt) * (cy - iccy) + iccy;
            this.car.position.x = x;
            this.car.position.y = y;
            //this.car.body.reset(x, y);
            this.car.angle = cangle + o_dt;
            this.car.body.angle = cangle + o_dt;
            this.car.angularVelocity = Math.abs(left - right) / this.wheel_base;

            const forward_speed = Math.abs(left - right) / this.wheel_base + (this.speed * this.velocity);
            velocity.angle = cangle + o_dt;
            velocity.x = Math.cos(velocity.angle * Math.PI / 180) * forward_speed;
            velocity.y = Math.sin(velocity.angle * Math.PI / 180) * forward_speed;
        }
        this.car.body.velocity.x = velocity.x;
        this.car.body.velocity.y = velocity.y;
    },

    update: function () {
        this.lineSensor();
        this.move();
    },

    render: function () {

    }

};

game.state.add('Game', DiffDrive, true);