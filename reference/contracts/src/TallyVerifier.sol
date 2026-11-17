// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract TallyVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 4624306765323686826377504231064965123678725506563720180688187750933438851849;
    uint256 constant alphay  = 6748919341650431433957267578454275903872459687141876925623463888858733357812;
    uint256 constant betax1  = 10547677195709930580200249594567349254536700465838861947723449525931878135302;
    uint256 constant betax2  = 6111130475920923686639937386270568180181103764771058478544107476186376318501;
    uint256 constant betay1  = 15995197721870437302024082393815708987924515477129799119481071719510526789939;
    uint256 constant betay2  = 4770420941634129972648904911836465168874479247187271847625901682823072414577;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 14452402770455592677329267808741698212247797663355006135288778047139627277523;
    uint256 constant deltax2 = 11418622415180411700374807141508529614743707597435296859858262133460980547433;
    uint256 constant deltay1 = 14671609144113014978537943864063059841560885589575534250048253800811564113148;
    uint256 constant deltay2 = 16153146707500156047362778147033752273385308339768231739918663780628155343905;

    
    uint256 constant IC0x = 81127725386417101196953923272200808971200218556902615686463029116748084318;
    uint256 constant IC0y = 1630019326284619751050902239045474335001162815036975176556886967365358442324;
    
    uint256 constant IC1x = 17307625593939656934515418834144459221299409514925041463472345623541078560547;
    uint256 constant IC1y = 6705905954592266698843674312642436659339594938196316967221977931085221831325;
    
    uint256 constant IC2x = 20589726441778311162517255957442899096571332437702837031699443736131140693382;
    uint256 constant IC2y = 5697149484996815741052458697042131862302308026078213575183397816331221459966;
    
    uint256 constant IC3x = 6782520470517876197756285231006112713147200743322365252096439323894776909713;
    uint256 constant IC3y = 6753461796655605190835642192645311839933295877896966872882868408726617868933;
    
    uint256 constant IC4x = 21700127987005392237569465761999901061401059024895704314385962998882124652880;
    uint256 constant IC4y = 16060023819633504867340079815877011080945496754944782881475952017585907933905;
    
    uint256 constant IC5x = 20381358020490449576394781068761089611869840122261378332264614824189352252762;
    uint256 constant IC5y = 3945489488399628937712766005517076842540546932103739346937136182190595117264;
    
    uint256 constant IC6x = 6238225306128821023609423987412575958610355483194833822622346949907869980219;
    uint256 constant IC6y = 3241242220849739758939805359263925700277118528070433337136662837950111277126;
    
    uint256 constant IC7x = 13751699075761435555707355360284991471680242275424230057155143658537387695741;
    uint256 constant IC7y = 15238370548251355405119264284840959656941469842415384461488478918344866786930;
    
    uint256 constant IC8x = 7596785701636861215580891908688307285631662563254169446368970676860798525134;
    uint256 constant IC8y = 9782565717322465389684395905499815289599294446994744604861083951463739402814;
    
    uint256 constant IC9x = 161762601742117938692912572387548372034684696777444093442364607144230772962;
    uint256 constant IC9y = 6978154548710693910416237184674258935775106258149023982650921116940606329322;
    
    uint256 constant IC10x = 10302062528270790272258622700934404174961014998322116237334632687353303199823;
    uint256 constant IC10y = 19674142430862511704000289325922936559056701410982015435205934616590588676954;
    
    uint256 constant IC11x = 19042241362668838692641514158930981606107150746271893703275198287493064494017;
    uint256 constant IC11y = 10561303635627738080496162534812198024871271388006479511309474268177024900408;
    
    uint256 constant IC12x = 12354964344808006042695550311183951498080778627163242154240215565882193654314;
    uint256 constant IC12y = 4388503029497550374188949777997421243242402926770582418229072128445064812026;
    
    uint256 constant IC13x = 17689355985731829495529386668717510857418730808949431275154045825236629584358;
    uint256 constant IC13y = 19752813553558571735790088293301929019378972360521244981088129353992511667434;
    
    uint256 constant IC14x = 19903756003601201024122510862886380879402906610551644153052660327671793203007;
    uint256 constant IC14y = 12911598376011854807068572980387675166746360564892052396092811527837748388298;
    
    uint256 constant IC15x = 6768009020957751152533785414509952910374066482415032516314566247363188486769;
    uint256 constant IC15y = 8105675790375856801687919422114190845431125324772060262614455458972652624369;
    
    uint256 constant IC16x = 12273378201055884035674320373456714132559573179494125186636436092380863540206;
    uint256 constant IC16y = 11392870799801533487900935561757775371447527540901122692352869579435459685910;
    
    uint256 constant IC17x = 10152084674962107609536163014756512445729332267755080697863514649088160617154;
    uint256 constant IC17y = 815942665640738393970496366713658944893856909883168860007571173250506213504;
    
    uint256 constant IC18x = 13933680625919632433352702858744165138294716738193529133769719008125607352332;
    uint256 constant IC18y = 16686425755515759429860779388862069823524523196926034476342688087897579160298;
    
    uint256 constant IC19x = 14486646362955325316097265645529560972468994940722926279334113045530593473592;
    uint256 constant IC19y = 10175723934209687882189953950144772838452944939995560617713400153426059274162;
    
    uint256 constant IC20x = 1939539766835360327635451917636775403990302962262413994998183132169549337294;
    uint256 constant IC20y = 6368986087051715268469527620483322357380119018471013328495747842787948077037;
    
    uint256 constant IC21x = 3041537716008471974701935782883118947137780914019205933760025472791242396655;
    uint256 constant IC21y = 5438570131000988303096090904034968044829879178065807433164104793639844743763;
    
    uint256 constant IC22x = 17831701689213039070256042527040133876659751302179438629666562702254833523250;
    uint256 constant IC22y = 13089757999750148578464191535282461381100911573840292498861293837568314600224;
    
    uint256 constant IC23x = 7824178406482785879474846048506710749454288734212619569706287877788331204444;
    uint256 constant IC23y = 1585704680032991528950799836454551580924647140203364117731303071984478543691;
    
    uint256 constant IC24x = 19813633041185735179249810116753857148210751103561526517882577203310576239974;
    uint256 constant IC24y = 8958041958561524506663186245509293571353902412833725417945325105853740537319;
    
    uint256 constant IC25x = 21019663119748370355638112644090151851787305106948965837906400711584320164781;
    uint256 constant IC25y = 11242151729769536186432746725089379376796473748624603555956761291574814267870;
    
    uint256 constant IC26x = 10179309789698595679688150740908228735342291894802298538515885918023906496095;
    uint256 constant IC26y = 401440973549387305696812306116726752997505856478209774923962802691390581970;
    
    uint256 constant IC27x = 21233796812409185922436681247704234511879722457175205685426674738617268588533;
    uint256 constant IC27y = 7923457950216575318794817003109267509387890424389836931011840877196083202896;
    
    uint256 constant IC28x = 10100532999085758758436203910800816112827964415535513201902289043181729860280;
    uint256 constant IC28y = 11430852678561627303736756219221712345180987843191830038522797355334188669854;
    
    uint256 constant IC29x = 566696546318712184499484204937096824625012357228107792530709402291332447056;
    uint256 constant IC29y = 14260445977902204698192576216419934937676224767613653939290251331079371041782;
    
    uint256 constant IC30x = 9052491758064010515668180348401469191062163844644395770893270229658807698034;
    uint256 constant IC30y = 16706118490518972223425286407080084745413023881121064201229275556958422596878;
    
    uint256 constant IC31x = 14483260325784684394929381195875211738193773725165607230741762121959286326210;
    uint256 constant IC31y = 2487270484424864481095688690568528848246664393597435726018203945177503580562;
    
    uint256 constant IC32x = 20707005573190795215597810280453799099861802909768157021457696067269788213220;
    uint256 constant IC32y = 1405978124088992402891313854676705549759473446203965906196040390394607824478;
    
    uint256 constant IC33x = 2410192729478212995642054951795896318022082162990503205026236695767265048880;
    uint256 constant IC33y = 19086815133036821571978797799078528471273262237726485690891878766455305362100;
    
    uint256 constant IC34x = 6355416536019184337083639685995047175533036563360728318285597415580739375540;
    uint256 constant IC34y = 10494761815976043460881045140459061997181989403960027125017426817923335748892;
    
    uint256 constant IC35x = 7117114109216010502636094622591174968748157093168059392350113464654041827333;
    uint256 constant IC35y = 18660168606731918174209908842394343551470335771103158015161584564244164069535;
    
    uint256 constant IC36x = 3046705101959948622149634604568994245931379485312403236979785586081104258399;
    uint256 constant IC36y = 4652503209179990903289288173986281645282198459532742342705624526584166581406;
    
    uint256 constant IC37x = 4634676291451662823187480279998203711060806866706882498846723451746412300449;
    uint256 constant IC37y = 11144760481219408457599677322716268974689047989448521086264764643530815134354;
    
    uint256 constant IC38x = 3425456174189595302821322003782829896928900808178389993489210664602354106585;
    uint256 constant IC38y = 14585391610009567375680624790150376050711196200149932992965620112107932288615;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[38] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                
                g1_mulAccC(_pVk, IC27x, IC27y, calldataload(add(pubSignals, 832)))
                
                g1_mulAccC(_pVk, IC28x, IC28y, calldataload(add(pubSignals, 864)))
                
                g1_mulAccC(_pVk, IC29x, IC29y, calldataload(add(pubSignals, 896)))
                
                g1_mulAccC(_pVk, IC30x, IC30y, calldataload(add(pubSignals, 928)))
                
                g1_mulAccC(_pVk, IC31x, IC31y, calldataload(add(pubSignals, 960)))
                
                g1_mulAccC(_pVk, IC32x, IC32y, calldataload(add(pubSignals, 992)))
                
                g1_mulAccC(_pVk, IC33x, IC33y, calldataload(add(pubSignals, 1024)))
                
                g1_mulAccC(_pVk, IC34x, IC34y, calldataload(add(pubSignals, 1056)))
                
                g1_mulAccC(_pVk, IC35x, IC35y, calldataload(add(pubSignals, 1088)))
                
                g1_mulAccC(_pVk, IC36x, IC36y, calldataload(add(pubSignals, 1120)))
                
                g1_mulAccC(_pVk, IC37x, IC37y, calldataload(add(pubSignals, 1152)))
                
                g1_mulAccC(_pVk, IC38x, IC38y, calldataload(add(pubSignals, 1184)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            
            checkField(calldataload(add(_pubSignals, 832)))
            
            checkField(calldataload(add(_pubSignals, 864)))
            
            checkField(calldataload(add(_pubSignals, 896)))
            
            checkField(calldataload(add(_pubSignals, 928)))
            
            checkField(calldataload(add(_pubSignals, 960)))
            
            checkField(calldataload(add(_pubSignals, 992)))
            
            checkField(calldataload(add(_pubSignals, 1024)))
            
            checkField(calldataload(add(_pubSignals, 1056)))
            
            checkField(calldataload(add(_pubSignals, 1088)))
            
            checkField(calldataload(add(_pubSignals, 1120)))
            
            checkField(calldataload(add(_pubSignals, 1152)))
            
            checkField(calldataload(add(_pubSignals, 1184)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
