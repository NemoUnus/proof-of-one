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

contract DocVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 5695647891058145426960992256924239258977162663247491423090033033549927848147;
    uint256 constant alphay  = 12733265912285760475369614862274621513389353530522689426312383006520304007458;
    uint256 constant betax1  = 17188853177100231683318768507376651386297005843729275101947347654738824529982;
    uint256 constant betax2  = 16046772795261360631872770483206825907800984977136063169057074951177603730360;
    uint256 constant betay1  = 12292672574052723815432127860729230633063172427493062034153727604500388164809;
    uint256 constant betay2  = 2598678333051668525174856434856193461287086780911027270199639036205042539859;
    uint256 constant gammax1 = 11628222563324298181230674495008344240186186826325519137593610615358287529212;
    uint256 constant gammax2 = 6831243439432830324813084301481941947356974712036823415176253777732738556231;
    uint256 constant gammay1 = 17925384280287611628018084016142832400779395652863340582106143584039524919439;
    uint256 constant gammay2 = 18846298836546160555052373845605078349585884040720348961824903102337542184854;
    uint256 constant deltax1 = 3628883038028850944881513950572053331780075276182269323324470636960766857522;
    uint256 constant deltax2 = 18369593787142627228396437495565997248027757595014760737103508814658377944098;
    uint256 constant deltay1 = 7177405643285582574332637269969080867215958208610218360308679444926037813928;
    uint256 constant deltay2 = 13560294035408069076432193212197627500290128495326813965045145908416813321341;

    
    uint256 constant IC0x = 10288259146277220752600697009078663651857813625666350211488784453022536831738;
    uint256 constant IC0y = 12362940774208669069157054012938387825974089523359587322701799269857130849662;
    
    uint256 constant IC1x = 20052876542992864566971495830521482441039301181447948416765213904744075935117;
    uint256 constant IC1y = 4220946337676305417818247407165481208959662385353753905238523336579724721829;
    
    uint256 constant IC2x = 20368617126928538263466574600185950744764241991555736559203845843651362447475;
    uint256 constant IC2y = 2804452252178874991290001629914883916285005904329982734211995580529617487180;
    
    uint256 constant IC3x = 9185154500818282737241244875520164013874980220831818765355028408871469203860;
    uint256 constant IC3y = 7510392224061989744782085848138819382978371119906796222150515195200847015194;
    
    uint256 constant IC4x = 6730911449735625193526853379867160294074357838683036638083748217929134854134;
    uint256 constant IC4y = 9635127944629906882733051882835694399884262347294702114566339812977805484052;
    
    uint256 constant IC5x = 19948398884478215299942994205933675579813135488584228171967508671598065713222;
    uint256 constant IC5y = 9062656481693757214353786804983184795211455519697602432078569430797323057904;
    
    uint256 constant IC6x = 9982027727518681873028510816386002201522688091101535503823054606631338748682;
    uint256 constant IC6y = 306297527210809631708901609721916256094503758890123324930269256732314676049;
    
    uint256 constant IC7x = 10133984477583160299648522200224704352004017882612976021410386148652121672658;
    uint256 constant IC7y = 5860157271617223176529370565674985418540794802067004448032064853503461483178;
    
    uint256 constant IC8x = 9225261798685070050547254964309262871955749780147268561094636190317915916723;
    uint256 constant IC8y = 19532992832744777736311363885010992394230966994475470398080478995306384158788;
    
    uint256 constant IC9x = 16372494698286714855847096043882255184547655144163477029954632864487093000196;
    uint256 constant IC9y = 19552572044942431279742956087202175702423950956130953894116341873718891463752;
    
    uint256 constant IC10x = 11150832328132925430469664613360157588331969748856481796559819896249722767679;
    uint256 constant IC10y = 8177957233847074559332751348098535751449245262363086891633565960581745778330;
    
    uint256 constant IC11x = 12407090240465003394494894949231398532161789952656733823833459835931406671080;
    uint256 constant IC11y = 3618913131525406145331958658399524921488252673304832219104215390803482137513;
    
    uint256 constant IC12x = 2465024424377314451102711620228160565392159597369673128588547182218909251886;
    uint256 constant IC12y = 15144837045839761671797347065293191173877983395507751584349266057468861565751;
    
    uint256 constant IC13x = 3307129824632163050773405530408368804434354575113448153556234228089229254750;
    uint256 constant IC13y = 12026105903184694272915653662757970307864490693117663773838928899273829002355;
    
    uint256 constant IC14x = 20204376505636567916414159723845264507301247797575124902671527035971520857688;
    uint256 constant IC14y = 18467509106680304568929631971630402274077630531084235208417162492760176587179;
    
    uint256 constant IC15x = 5101997095149694108735567277627350136526950421241550525119846669949836701492;
    uint256 constant IC15y = 6261396408252519825099284856370158920490230863507131497268112600245007724614;
    
    uint256 constant IC16x = 14363347936236101675651294410633407298282501326600647990960194981276128646100;
    uint256 constant IC16y = 18560601764329490538784049224945166188053266988641684822151837860943141194359;
    
    uint256 constant IC17x = 14669041986205451418559071135115321735732875452935711895690762608142021163361;
    uint256 constant IC17y = 16251660351656497494611787317677265180203699907738700784939558339918994366543;
    
    uint256 constant IC18x = 5704387722636570966440402249876759445684411357541849928207365491769498686435;
    uint256 constant IC18y = 19953816320643069539858824638473850459102829444878639451299688308687777370381;
    
    uint256 constant IC19x = 6718078816683135054417768722594196137369352049801410773095491857679066510237;
    uint256 constant IC19y = 12511765137066073601711649917722968331347496416760283447746007662645539624370;
    
    uint256 constant IC20x = 16548947327913346988833396553067512887029154201192173780251823603487771161465;
    uint256 constant IC20y = 4484534122564962402175084318207224164054568745442854237494198736193700610297;
    
    uint256 constant IC21x = 4803017752310961008579809606460718040428072632809310572615265191526660751831;
    uint256 constant IC21y = 5963461321263808309245250541721874697855966625644801056937836413671193393820;
    
    uint256 constant IC22x = 15708566069453506389372526653056840769881402659384686634391364883896255805742;
    uint256 constant IC22y = 1917137035890154725207645356295478976179700292857968892584839990656417848130;
    
    uint256 constant IC23x = 19562510278686728279443419800334660159993204473274016709831115653763146502926;
    uint256 constant IC23y = 21541354550267572031410459215635381687337928044783305534741988809123811591500;
    
    uint256 constant IC24x = 12449314128519617194533245330118409818619898095202960429347891791342791718788;
    uint256 constant IC24y = 18724626971059442625236605848406676772152881847735917823270321952694530125588;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[24] calldata _pubSignals) public view returns (bool) {
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
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
