pragma circom 2.1.0;

include "include/poseidon.circom";
include "include/escalarmulany.circom";

// Note structure
// owner, nonce, encodedAsset, encodedAssetId, value

template NoteCommit() {
    signal input ownerHash;
    signal input nonce;
    signal input encodedAssetAddr;
    signal input encodedAssetId;
    signal input value;

    signal output out;

    component noteHash = Poseidon(5);
    noteHash.inputs[0] <== ownerHash;
    noteHash.inputs[1] <== nonce;
    noteHash.inputs[2] <== encodedAssetAddr;
    noteHash.inputs[3] <== encodedAssetId;
    noteHash.inputs[4] <== value;

    out <== noteHash.out;
}

template DeriveNullifier() {
    signal input vk;
    signal input noteCommitment;

    signal output nullifier;

    component hash = Poseidon(2);
    hash.inputs[0] <== vk;
    hash.inputs[1] <== noteCommitment;
    nullifier <== hash.out;
}

template vkIntegrity() {
    signal input H1X;
    signal input H1Y;
    signal input H2X;
    signal input H2Y;
    signal input vk;

    // G = vk * H1
    signal GX, GY, GGX, GGY, GG2X, GG2Y, GG4X, GG4Y, GG8X, GG8Y;
    signal G[2];
    G <== EscalarMulAny(254)(Num2Bits(254)(vk), [H1X, H1Y]);
    // GG = vk * H1 - H2
    (GGX, GGY) <== BabyAdd()(G[0], G[1], -H2X, H2Y);
    (GG2X, GG2Y) <== BabyDbl()(GGX, GGY);
    (GG4X, GG4Y) <== BabyDbl()(GG2X, GG2Y);
    (GG8X, GG8Y) <== BabyDbl()(GG4X, GG4Y);

    GG8X === 0;
    GG8Y === 1;
}

template SigVerify() {
    signal input pk[2];
    signal input m;
    signal input sig[2]; // [c, z]

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    component gz = EscalarMulFix(254, BASE8);
    component pkc = EscalarMulAny(254);
    component zBits = Num2Bits(254);
    component cBits = Num2Bits(254);

    zBits.in <== sig[1];
    for (var i = 0; i < 254; i++) {
        gz.e[i] <== zBits.out[i];
    }

    pkc.p <== pk;
    cBits.in <== sig[0];
    for (var i = 0; i < 254; i++) {
        pkc.e[i] <== cBits.out[i];
    }

    component R = BabyAdd();
    R.x1 <== gz.out[0];
    R.y1 <== gz.out[1];
    R.x2 <== pkc.out[0];
    R.y2 <== pkc.out[1];

    signal cp <== Poseidon(3)([R.xout, R.yout, m]);
    cp === sig[0];
}

template canonAddr() {
    signal input userViewKey;
    signal output addr[2];

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    addr <== EscalarMulFix(254, BASE8)(Num2Bits(254)(userViewKey));
}

// Forces the input signal to be of value between 0 and 2**n - 1
template BitRange(n) {
    signal input in;
    signal bits[254] <== Num2Bits(254)(in);
    for (var i = 253; i >= n; i--) {
      bits[i] === 0;
    }
}

// Encrypt each input value, using poseidon as as a blockcipher in counter
// mode, with rand as initial value (IV)
template Encrypt(n) {
    signal input rand;
    signal input in[n];

    signal output out[n];

    for (var i = 0; i < n; i++) {
      var pad = Poseidon(1)([rand + i]);
      out[i] <== pad + in[i];
    }
}