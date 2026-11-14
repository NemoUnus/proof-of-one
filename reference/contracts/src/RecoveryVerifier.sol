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

contract RecoveryVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 12654418584005521938616259350248061107709387192811074812349540681287270808024;
    uint256 constant alphay  = 19623357941204773907324456742979596345800497583846765507762640786651424006172;
    uint256 constant betax1  = 10931592356951298416747497105944654739357171531166890112088398358635329010214;
    uint256 constant betax2  = 17497289592581832377838517538652813072580911604500931704973570461272232446388;
    uint256 constant betay1  = 11730309147996210312597663313212916889435054672217257243091615375437532533239;
    uint256 constant betay2  = 486573751106576090284163492990321370371445201191637674100987327185686003443;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 14843842304972334337673357071613014334754295225950014309070768921262069831506;
    uint256 constant deltax2 = 4924253403759436052155063884435612560169396784524196965368186537183823027815;
    uint256 constant deltay1 = 4061091669934552036141828161987763591646773550381661172331893042421995465139;
    uint256 constant deltay2 = 16973179213635248156817230810582847019904201965536487896182517856187204770703;

    
    uint256 constant IC0x = 7447257946156925796938231344746072307344546558191284821155317898599947089209;
    uint256 constant IC0y = 20246514466473425247290029900228229617555953290539774132369391086625624963597;
    
    uint256 constant IC1x = 4247785551750057866392913848052572357074109198216229158824954753135143581038;
    uint256 constant IC1y = 3197073202998686911770749894349680730940945480778990132567719251942129747863;
    
    uint256 constant IC2x = 13322666045833455879875434350644327722763072029957134507982723640208865617147;
    uint256 constant IC2y = 14919570112021150831262994902046149791903696486316207497845133324453163680677;
    
    uint256 constant IC3x = 4821245612143799157717956484808302704131943879147166982744492333762008343726;
    uint256 constant IC3y = 20224066873233851504836094753340958136277849780332833271794369461791345815304;
    
    uint256 constant IC4x = 4830619979001505882519040897505306201619979906632927314400838070924570471348;
    uint256 constant IC4y = 5878068360876555902185361878220148376299563481140776758156169865593892905663;
    
    uint256 constant IC5x = 1906060202774202819636987444692410404532175931765057952060327453588320711960;
    uint256 constant IC5y = 19679013825587069622685527551171914503582708685770404941828507198847664205342;
    
    uint256 constant IC6x = 6560108499752808835699520367055367746306006554734393611223732250211646251277;
    uint256 constant IC6y = 5417430745818836067315360689046179826718298277845219591330258126686482845909;
    
    uint256 constant IC7x = 17607212048447728903233002807359798586933877980217335983648498734200169220047;
    uint256 constant IC7y = 14836308877052330670614743998072022934317184026714064148396239304362653392713;
    
    uint256 constant IC8x = 10210181939255687913258696767146008340848693900195767164475895794847635054489;
    uint256 constant IC8y = 17359665077125737938913854950054440890482990926952718226738730105104253984572;
    
    uint256 constant IC9x = 21194394213685470401451184921288381178870193466820963349034281163572574049250;
    uint256 constant IC9y = 10929145510024504784238361666427336414666903429364655313623206194664248427439;
    
    uint256 constant IC10x = 4626728733491544610470469508633322832786412955985985061063080565105158799062;
    uint256 constant IC10y = 7921578263676145789450591589550823419688441701276686693125781354399692443531;
    
    uint256 constant IC11x = 162269499624022819031553445229767730538603263210041787664521703866893310846;
    uint256 constant IC11y = 14887277219482380927108891777492499484765639823677705877324165259912010092233;
    
    uint256 constant IC12x = 7972898137894747867289294888241471946405489964721620284095989381267048041784;
    uint256 constant IC12y = 7798499580625301316444394101243479149148543320070351506101385307688474078376;
    
    uint256 constant IC13x = 11956335661998664149452026597267990390320618458816383050494066259225583973355;
    uint256 constant IC13y = 8812599747774592676229386768522321486972800544438782662480458445029529889409;
    
    uint256 constant IC14x = 4163215075402233161226175428622012832436539503885378800053943533281420222303;
    uint256 constant IC14y = 11945208653092078170981622352982860731492184536157941618176139664527643181041;
    
    uint256 constant IC15x = 14394231606347944152418467158479273103234412769038577690549021987434954216036;
    uint256 constant IC15y = 6602114180418081465564705676555824765003104100227611122836901260910045881409;
    
    uint256 constant IC16x = 5012396302914136950628316585927455910325933121967209801514818024331451614507;
    uint256 constant IC16y = 18627856196311631457900935568630891934186398116573325901559772882422943427180;
    
    uint256 constant IC17x = 12669945364114844672083081028772618077764618064387246183602565416215078627060;
    uint256 constant IC17y = 3234001203042742733207780405099892294763389604956225676735086082246909543180;
    
    uint256 constant IC18x = 10754608128935482416724518311869687883008698251580551264478727156673681339436;
    uint256 constant IC18y = 20860092343279665081941345533543789039086694127800418107053062724809676101055;
    
    uint256 constant IC19x = 18370174906957040022511938628796403170700086926574069106984069118377229823506;
    uint256 constant IC19y = 2969551823355555273780192779583495687724043027170472091362638453286980642241;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[19] calldata _pubSignals) public view returns (bool) {
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
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
