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
    uint256 constant deltax1 = 1323991406702492741683977343378964754467814043510868302181029750738270630834;
    uint256 constant deltax2 = 14541221158949102232952066458401853329895289494691149039113113636573063150644;
    uint256 constant deltay1 = 20604494989383449226392844551100560594330612188769208898578693452023261610937;
    uint256 constant deltay2 = 2934417967248385054351542043281015386438926562404771188511084740295558150163;

    
    uint256 constant IC0x = 12753130283807412287919574550580034744175321197766330528617617201278542604952;
    uint256 constant IC0y = 20996813276752443802742398415030627629769263240588793042270758195286617168868;
    
    uint256 constant IC1x = 19922904990545909456884764436990593572223992591918749905913970040992112251786;
    uint256 constant IC1y = 1386246112830376827809828998634966677640840044741454438453614258981541266853;
    
    uint256 constant IC2x = 13822662565570958315374548277183517958728916370479348020039912403525203988420;
    uint256 constant IC2y = 10482237111754869784721670453326165830659517635573080338650253987999971875197;
    
    uint256 constant IC3x = 826677349824650655443449427119234628864188959234347273335554595713977847251;
    uint256 constant IC3y = 20026545318467026244405428265646005730573491157932747348265193690468208273168;
    
    uint256 constant IC4x = 14797502032867397476715117198831434353915166176436911252470998771290780971785;
    uint256 constant IC4y = 14009709094126772559436939148830862789627358911848177255176752031301571405563;
    
    uint256 constant IC5x = 19548110225750480247817416353227194336435839390942751649830197825639925377110;
    uint256 constant IC5y = 11691368713562610452024614215946498005983465767925447273350403121050762837864;
    
    uint256 constant IC6x = 7690307425717711908135102588169979580218373446458756608894113675138134817684;
    uint256 constant IC6y = 16691569293792528059337934395010406501928017120947077329507707672385104865772;
    
    uint256 constant IC7x = 20914494127754274009431106485611262014339464768523136315670240870366172920572;
    uint256 constant IC7y = 6955204719512757699666486893317325496121143099787941833182240550552572710007;
    
    uint256 constant IC8x = 10088707315275946614917144481443932718237406947181286907205419956254370668668;
    uint256 constant IC8y = 16540598411957742931080077518198394171067732138965660922784645888062998123559;
    
    uint256 constant IC9x = 2597043375906240324948451595144436627208603885780187577860538074377058817815;
    uint256 constant IC9y = 18121634756133786270951262799183515607419290472022603470188468047700841073906;
    
    uint256 constant IC10x = 18189575649043577631249079833281870812714070675046822575877115073687003482568;
    uint256 constant IC10y = 14529777497998027165379137467991773639998455614411676951058676949842420455427;
    
    uint256 constant IC11x = 10050401228772545654676899432603968344967300094157567487706891303633064321480;
    uint256 constant IC11y = 21379568348529620746149989797013321049995977533015601546139982865193418310125;
    
    uint256 constant IC12x = 15468103773465844260353829674962418319794752246485870025410039418446053914179;
    uint256 constant IC12y = 8767444897067105538654886911730541741562438805180556768379121114304039412023;
    
    uint256 constant IC13x = 13346281666092463384041880391366876680609509748808836143545747166928274044766;
    uint256 constant IC13y = 13475176481705295276421529339189989383038805234053951416448496746689883099258;
    
    uint256 constant IC14x = 21691172574143532437023402888576456250012025017646176043959097341111118225685;
    uint256 constant IC14y = 861401423297786305580538314775059495885262953684568358521648261759957516475;
    
    uint256 constant IC15x = 13043521306194608539790483524705108002088798514699823537370283356166066110030;
    uint256 constant IC15y = 16122671747197970816025394129941573944081686605735785858337671354250100171079;
    
    uint256 constant IC16x = 12535612342251766031045710026665874016535544978543426642896718422037500258085;
    uint256 constant IC16y = 17534932719557877995533280263379242879805781524134331079393240429700358254635;
    
    uint256 constant IC17x = 6998483273056870183830900043554731145418668539719633254097677443162453525493;
    uint256 constant IC17y = 11146090636937797031754320287596706983252438332807030410526379256805723667643;
    
    uint256 constant IC18x = 3473746506050891472165842891076366688310731164012291302219924925902487532248;
    uint256 constant IC18y = 9641276242255269423516372533388181137474753669560087857880532444522965898772;
    
    uint256 constant IC19x = 17808736892781208283538418183595628321642813051816239338678265873074250645450;
    uint256 constant IC19y = 7766165209090467449115926679814220294709702907082514162352981965545745807854;
    
    uint256 constant IC20x = 6271999743819388917550604117080462707597854205395496360847291804411982911991;
    uint256 constant IC20y = 10271948630991130397784792965976537380123787563709231972723165694320198818218;
    
    uint256 constant IC21x = 13880794279583284705831144828494714243578618122607764318311291529683369963322;
    uint256 constant IC21y = 1156698719020177420167430737666883438933326083111307460372301670249390725894;
    
    uint256 constant IC22x = 3091145094571349518678289694767329986645137391069018039036537392790453970499;
    uint256 constant IC22y = 16166608392395813753672457414813644529930073605966437197558115312573755235062;
    
    uint256 constant IC23x = 16895180771100372259356218364326832670851086308113247784911754554721114943519;
    uint256 constant IC23y = 17131951919189376486179321409378201256760254753837613821058364957413031641108;
    
    uint256 constant IC24x = 14949912339085226482399619197884235373827481508355476490505110150983010181145;
    uint256 constant IC24y = 14784971954630416931672861772113292619739226091913348832842366892814440777443;
    
    uint256 constant IC25x = 17653065371111206058370279869930676268247966544451705684318141693379861179815;
    uint256 constant IC25y = 2519294157467155598943347068980043192389652165629743398822247374698729592256;
    
    uint256 constant IC26x = 15551505917527961569699951807012607644711410794086095109874476840567629895770;
    uint256 constant IC26y = 15231708205864748247736317751470135826480359417909935470603883515546069969906;
    
    uint256 constant IC27x = 2600649365196921993360847267006947220751486622575800150604976762603606877783;
    uint256 constant IC27y = 16111845647756231769461427797201147323123570991343640038011865053071427553172;
    
    uint256 constant IC28x = 6895102179615930460434489832878071397390513895496979040458053100282724173252;
    uint256 constant IC28y = 16268332558137976207629463654495819620084045458987556757086206764043618212041;
    
    uint256 constant IC29x = 6127049330593465118188805117694800481452950165550480937967276077909101486429;
    uint256 constant IC29y = 2926334832115851164178118831204418263210495824244523295532287605532586677873;
    
    uint256 constant IC30x = 16893877532379129157044630354869535736170512259108937256653510834378588544633;
    uint256 constant IC30y = 15697400965667002454741187189217279125459825962466480672409391747835172662915;
    
    uint256 constant IC31x = 14335244815707198658111694281648929171531816289727595517854232135104415169961;
    uint256 constant IC31y = 17320578618294980659774722704495046063553689223179061891347817843483047009928;
    
    uint256 constant IC32x = 18274806695870881064156494128205356918089037898152125187805897868805984333924;
    uint256 constant IC32y = 14706667626580161801322445276863840762532927144287912051123919761684091747701;
    
    uint256 constant IC33x = 15908448116752720917415519277335160045841921061422576160176288785875716678255;
    uint256 constant IC33y = 1808866976981672643223992473914328164702142707307728690336889416431325090475;
    
    uint256 constant IC34x = 5542105569412548495748805921216705647973107683396935624227337680428756685603;
    uint256 constant IC34y = 19354372184042614987883050030508053030107935782239194077945834732490255256786;
    
    uint256 constant IC35x = 11914789710444715106872535864428282511490112744710330717003321200134933745199;
    uint256 constant IC35y = 759806319425623613112720987533192876955610982920684545808150918827116886808;
    
    uint256 constant IC36x = 8691590664962860894261819735558849823324075833968098743329252833518569082590;
    uint256 constant IC36y = 14948098562053355752317954524844323214972176769220992794533895264333277627548;
    
    uint256 constant IC37x = 8933267683644804477144028752149294725025379651300527352243915329772713529098;
    uint256 constant IC37y = 19699096001501854429619423876496754183320787314182068665210318090386250773199;
    
    uint256 constant IC38x = 18256968494529620753848547280488558296756068839373887637652739517532464885659;
    uint256 constant IC38y = 13860030058810014107769515819042757954459692418531155619068853442503322275280;
    
 
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
