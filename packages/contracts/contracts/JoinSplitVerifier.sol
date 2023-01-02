// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Pairing} from "./libs/Pairing.sol";
import {Groth16} from "./libs/Groth16.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";

contract JoinSplitVerifier is IJoinSplitVerifier {
    function verifyingKey()
        internal
        pure
        returns (Groth16.VerifyingKey memory vk)
    {
        vk.alpha1 = Pairing.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = Pairing.G2Point(
            [
                4252822878758300859123897981450591353533073413197771768651442665752259397132,
                6375614351688725206403948262868962793625744043794305715222011528459656738731
            ],
            [
                21847035105528745403288232691147584728191162732299865338377159692350059136679,
                10505242626370262277552901082094356697409835680220590971873171140371331206856
            ]
        );
        vk.gamma2 = Pairing.G2Point(
            [
                11559732032986387107991004021392285783925812861821192530917403151452391805634,
                10857046999023057135944570762232829481370756359578518086990519993285655852781
            ],
            [
                4082367875863433681332203403145435568316851327593401208105741076214120093531,
                8495653923123431417604973247489272438418190587263600148770280649306958101930
            ]
        );
        vk.delta2 = Pairing.G2Point(
            [
                17042891744255105165583436458188863991413943693735594860830234107407837910266,
                10238479254134046863273807981566684719791190039852772348198752302511812717600
            ],
            [
                4839598380573200109312786626040621962865935613729560908533243598359958786476,
                1866022701126383052430532038418704436363855179819586491771593174861660058478
            ]
        );
        vk.IC = new Pairing.G1Point[](10);

        vk.IC[0] = Pairing.G1Point(
            19986063471129479843454232016169495567974649681830017826541460883348293500370,
            11003652143407398051064664553823535540096657218071868348927422147193689870889
        );

        vk.IC[1] = Pairing.G1Point(
            21647706542525731171478926147610961736898851826370945532199104370650128205344,
            19791930638587172996359763693473269090849236644619279535413035668446443866464
        );

        vk.IC[2] = Pairing.G1Point(
            455568674420234917861110779768922338299449128720857658893420619571799076661,
            6822436194318531517210026185567959471329885212321933679112776509550934597032
        );

        vk.IC[3] = Pairing.G1Point(
            3335443351314385218572781857402930461686478059795573536153378227433309916294,
            14735962925319325092918499970970242856307650974747100282670282876069934644083
        );

        vk.IC[4] = Pairing.G1Point(
            20963944418994132492682920821610725138953902759258177012294705983540816585827,
            17851476169920452507942158043652177951157928133508594095423291650797088099833
        );

        vk.IC[5] = Pairing.G1Point(
            10982519099537163872447684680605686840101884362040416487037955747367717993663,
            16640584775387331460442343813391170155723831275406554836182608276708032082084
        );

        vk.IC[6] = Pairing.G1Point(
            11459314298365421948090759454862040662939872974513083510264200641130086599927,
            5617567725408253992736925723563801843963932528584948829735862037869562910956
        );

        vk.IC[7] = Pairing.G1Point(
            10967036588499745306808551537386032135654989655389763964902540321561316325471,
            12153267430443971868078097384854542674493828351442397380446910114893613415834
        );

        vk.IC[8] = Pairing.G1Point(
            1626386488670941161947359008207231157155366612543668028830155009898351948618,
            19613959815547732050285399533732681432148074902547546880309465160544369724970
        );

        vk.IC[9] = Pairing.G1Point(
            5172765070889932384229504388132983255138474456238205153343233593484333437449,
            3775258618804889722862874819771786206661430939505689277845950768624289246172
        );
    }

    /// @return r  bool true if proof is valid
    function verifyProof(
        Groth16.Proof memory proof,
        uint256[] memory pi
    ) public view override returns (bool r) {
        return Groth16.verifyProof(verifyingKey(), proof, pi);
    }

    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        Groth16.Proof[] memory proofs,
        uint256[][] memory allPis
    ) public view override returns (bool) {
        return Groth16.batchVerifyProofs(verifyingKey(), proofs, allPis);
    }
}
