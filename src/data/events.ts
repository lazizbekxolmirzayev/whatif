import type { HistoricalEvent } from '../types'
import { EXTRA_EVENTS } from './events-extra.ts'

/**
 * Editorial rules for this file:
 *  - `summary`, `verifiedFacts`, `pivot.actual`, `factors` describe documented history.
 *  - `scenarios` are fiction. They are rendered with a "Fictional" badge everywhere.
 *  - No quotations or source citations are invented. Where historians disagree, the text says so.
 */
const BASE_EVENTS: HistoricalEvent[] = [
  {
    id: 'caesar-ides-of-march',
    title: 'Assassination of Julius Caesar',
    year: -44,
    dateLabel: '15 March 44 BCE',
    era: 'Ancient',
    region: 'Europe',
    place: 'Rome, Roman Republic',
    lat: 41.8957,
    lng: 12.4768,
    summary:
      'Julius Caesar, appointed dictator for life weeks earlier, was stabbed to death by a group of senators at a meeting held in the portico complex of the Theatre of Pompey.',
    verifiedFacts: [
      'Caesar was named dictator perpetuo (dictator for life) in early 44 BCE.',
      'Marcus Junius Brutus and Gaius Cassius Longinus were among the leaders of the conspiracy.',
      'Ancient authors such as Plutarch and Suetonius report omens and warnings before the meeting; how reliable these accounts are is debated.',
      'Caesar’s great-nephew Octavian was named his heir in the will.',
      'Octavian, Mark Antony and Lepidus formed the Second Triumvirate in 43 BCE; Octavian later became Augustus, the first Roman emperor.',
    ],
    pivot: {
      question: 'Should Caesar attend the Senate meeting despite the warnings he reportedly received?',
      actual: 'Caesar attended, reportedly after being persuaded not to cancel, and was killed.',
      alternatives: [
        'Caesar cancels the meeting and the plot is postponed.',
        'Caesar attends with an armed escort, as he had earlier dismissed his Spanish bodyguard.',
        'The conspirators are exposed before the meeting.',
      ],
    },
    factors: [
      'The Republic’s elite feared monarchy and Caesar’s concentration of offices.',
      'Caesar had planned a major campaign against Parthia, due to leave days later.',
      'Mark Antony was consul and controlled much of the political machinery.',
      'The veteran legions were loyal to Caesar personally.',
    ],
    related: [],
    scenarios: [
      {
        id: 'caesar-parthia',
        title: 'The Parthian departure',
        premium: false,
        premise: 'The meeting is moved and the plot fails to find another chance before Caesar leaves for Parthia.',
        assumptions: [
          'The conspirators do not act in a less favourable setting.',
          'Caesar’s Parthian campaign proceeds on the schedule he planned.',
        ],
        chapters: [
          { horizon: 'First year', text: 'Caesar leaves Rome with a large army. In his absence the conspirators’ grievances harden rather than dissolve, and Rome is governed by his deputies.' },
          { horizon: 'First decade', text: 'The eastern campaign either succeeds and makes Caesar unassailable, or stalls like Crassus’s earlier expedition. Either outcome reshapes who holds power in Rome.' },
          { horizon: 'Long run', text: 'Without the civil wars of the 40s and 30s BCE, the transition from Republic to one-man rule might be smoother, or fail differently. This is speculation; there is no way to know.' },
        ],
      },
      {
        id: 'caesar-survives-reform',
        title: 'A reformer-king without a crown',
        premium: true,
        premise: 'Caesar survives and spends his remaining years consolidating the reforms he had begun.',
        assumptions: [
          'Caesar lives for roughly another decade.',
          'He continues reforms such as calendar reform and citizenship extensions on the scale he had begun.',
        ],
        chapters: [
          { horizon: 'First year', text: 'Elite resentment continues. Caesar relies more openly on his army and on loyal magistrates.' },
          { horizon: 'First decade', text: 'Provincial elites gain citizenship and Italian veterans are settled. A formal succession arrangement becomes necessary and contested.' },
          { horizon: 'Long run', text: 'The empire’s institutions might look similar to Augustus’s settlement, perhaps arriving sooner and with fewer proscriptions, or perhaps with a different dynasty entirely.' },
        ],
      },
    ],
  },
  {
    id: 'hastings-1066',
    title: 'Battle of Hastings',
    year: 1066,
    dateLabel: '14 October 1066',
    era: 'Medieval',
    region: 'Europe',
    place: 'Battle, Sussex, England',
    lat: 50.912,
    lng: 0.488,
    summary:
      'William, Duke of Normandy, defeated the English army of King Harold Godwinson, who was killed in the battle. William was crowned King of England on Christmas Day 1066.',
    verifiedFacts: [
      'Harold had defeated Harald Hardrada of Norway at Stamford Bridge on 25 September 1066, in the north of England.',
      'William’s army landed in Sussex a few days later, on 28 September.',
      'Harold’s army marched south quickly and fought William at Hastings on 14 October.',
      'Harold was killed in the battle. William was crowned at Westminster Abbey on 25 December 1066.',
    ],
    pivot: {
      question: 'Should Harold give battle quickly, or wait to gather a larger army?',
      actual: 'Harold marched south and fought within about two weeks of his northern victory.',
      alternatives: [
        'Harold delays and lets the Normans exhaust their supplies in Sussex.',
        'Harold’s shield wall holds throughout the day.',
        'Harold’s brothers’ forces arrive in time to join him.',
      ],
    },
    factors: [
      'William had to keep an army fed and in the field far from home.',
      'Harold’s army had just fought a major battle and marched a long distance.',
      'The Norman force combined cavalry with archers; the English fought mainly on foot.',
      'English succession was contested by several claimants in 1066.',
    ],
    scenarios: [
      {
        id: 'hastings-harold-holds',
        title: 'The shield wall holds',
        premium: false,
        premise: 'The English line stays unbroken until nightfall and William withdraws.',
        assumptions: ['William’s army is unable to resupply quickly.', 'Harold survives the day.'],
        chapters: [
          { horizon: 'First year', text: 'The Norman army is stranded on the coast. Harold’s position as king is secured for the moment, but he faces other claimants.' },
          { horizon: 'First decade', text: 'Without a Norman conquest, England stays tied to Scandinavia and the North Sea world rather than to France.' },
          { horizon: 'Long run', text: 'The English language might keep more of its Germanic structure and fewer French loanwords. Many later developments in law and landholding would differ.' },
        ],
      },
      {
        id: 'hastings-delay',
        title: 'Harold waits in London',
        premium: true,
        premise: 'Harold rests his army in London and lets William come to him.',
        assumptions: ['William does not raid so aggressively that waiting becomes politically impossible.'],
        chapters: [
          { horizon: 'First year', text: 'A rested, reinforced English army meets William later in the autumn. The campaigning season starts to run out for the invader.' },
          { horizon: 'First decade', text: 'A failed or negotiated invasion leaves William weakened at home in Normandy.' },
          { horizon: 'Long run', text: 'A less Normanised English monarchy and church. This is purely conjecture.' },
        ],
      },
    ],
  },
  {
    id: 'hakata-bay-1281',
    title: 'Mongol Invasion of Japan (1281)',
    year: 1281,
    dateLabel: 'Summer 1281',
    era: 'Medieval',
    region: 'Asia',
    place: 'Hakata Bay, Kyushu, Japan',
    lat: 33.635,
    lng: 130.35,
    summary:
      'The Yuan dynasty sent a very large second fleet against Japan. After weeks of fighting around Kyushu, a typhoon destroyed much of the fleet.',
    verifiedFacts: [
      'A first Mongol-led invasion attempt had occurred in 1274.',
      'After 1274, Japanese defenders built a defensive stone wall around Hakata Bay.',
      'The 1281 invasion consisted of two fleets, one from Korea and one from southern China.',
      'A typhoon in the summer of 1281 destroyed a large part of the invasion fleet. Later Japanese tradition called such storms kamikaze (“divine wind”).',
      'Historians disagree on how decisive the storm was compared with Japanese resistance and Yuan logistical problems.',
    ],
    pivot: {
      question: 'Should the Yuan fleets keep massing offshore, or land and fortify a beachhead?',
      actual: 'Large forces remained largely on their ships and islands near the coast when the typhoon struck.',
      alternatives: [
        'The Yuan secure a fortified beachhead before the storm season.',
        'The fleets disperse to safe harbours when weather turns.',
        'The invasion is launched earlier in the year.',
      ],
    },
    factors: [
      'Coordinating two fleets from distant ports was difficult.',
      'The stone wall at Hakata limited landing sites.',
      'The typhoon season in the East China Sea was well known to local sailors.',
      'Kublai Khan’s resources were also committed elsewhere in Asia.',
    ],
    scenarios: [
      {
        id: 'hakata-beachhead',
        title: 'A fortified beachhead',
        premium: false,
        premise: 'The Yuan forces secure a defensible foothold on Kyushu before the storm.',
        assumptions: ['The two fleets arrive in time to combine.', 'The Japanese defence is stretched thin.'],
        chapters: [
          { horizon: 'First year', text: 'A grinding campaign in Kyushu. The Kamakura shogunate’s vassals face costly fighting without gaining new land to reward their loyalty.' },
          { horizon: 'First decade', text: 'Either Japan expels the invaders at great cost, or a Yuan presence on Kyushu changes the region’s politics.' },
          { horizon: 'Long run', text: 'The later political history of Japan, including the weakening of the shogunate, would take a different path. This is speculation.' },
        ],
      },
      {
        id: 'hakata-typhoon-avoided',
        title: 'The fleet reaches safe harbour',
        premium: true,
        premise: 'The fleet commanders heed the weather and shelter in time.',
        assumptions: ['Commanders have reliable local pilots.'],
        chapters: [
          { horizon: 'First year', text: 'The campaign resumes in the autumn with a largely intact force.' },
          { horizon: 'First decade', text: 'The Kamakura government must keep the whole coastal defence mobilised for years.' },
          { horizon: 'Long run', text: 'Japan’s later self-image would not include the “divine wind” narrative, or would include it differently.' },
        ],
      },
    ],
  },
  {
    id: 'ankara-1402',
    title: 'Battle of Ankara',
    year: 1402,
    dateLabel: '28 July 1402',
    era: 'Medieval',
    region: 'Asia',
    place: 'Near Ankara, Anatolia',
    lat: 39.9334,
    lng: 32.8597,
    summary:
      'Timur (Tamerlane), the ruler of a Central Asian empire centred on Samarkand, defeated the Ottoman Sultan Bayezid I near Ankara. Bayezid was captured.',
    verifiedFacts: [
      'Timur’s capital was Samarkand, in present-day Uzbekistan.',
      'Bayezid I had been besieging Byzantine Constantinople before turning to face Timur.',
      'Several Anatolian Turkic contingents in Bayezid’s army went over to Timur during the battle.',
      'Bayezid died in captivity in 1403.',
      'The Ottoman state then went through a civil war known as the Ottoman Interregnum (1402–1413), which Mehmed I eventually won.',
      'Timur died in 1405 while on the way to campaign against Ming China.',
    ],
    pivot: {
      question: 'Should Bayezid give battle to Timur’s army, or avoid it?',
      actual: 'Bayezid fought, and was captured when his army broke.',
      alternatives: [
        'Bayezid avoids battle and retreats toward Ottoman Europe.',
        'The Anatolian contingents remain loyal.',
        'Bayezid and Timur negotiate.',
      ],
    },
    factors: [
      'Bayezid’s army combined Anatolian and Balkan troops with divided loyalties.',
      'Timur had a long record of successful campaigns and a veteran army.',
      'Constantinople was under pressure from the Ottomans.',
      'Ottoman succession was not governed by a fixed rule.',
    ],
    related: ['constantinople-1453'],
    scenarios: [
      {
        id: 'ankara-bayezid-avoids',
        title: 'The Ottomans avoid battle',
        premium: false,
        premise: 'Bayezid retreats and keeps his army intact; Timur withdraws without a decisive victory.',
        assumptions: ['Timur does not pursue into Europe.', 'The Anatolian beyliks do not defect.'],
        chapters: [
          { horizon: 'First year', text: 'Constantinople’s siege resumes. The Byzantines lose the reprieve that Ankara historically gave them.' },
          { horizon: 'First decade', text: 'With no civil war, the Ottoman state consolidates earlier. Its later conquests may come sooner.' },
          { horizon: 'Long run', text: 'The fall of Constantinople could occur decades before 1453. Speculative, since this depends on many other factors.' },
        ],
      },
      {
        id: 'ankara-timur-west',
        title: 'Timur turns west',
        premium: true,
        premise: 'Timur, after Ankara, pushes into the Balkans rather than returning east.',
        assumptions: ['Timur’s supply lines and health allow a longer campaign.'],
        chapters: [
          { horizon: 'First year', text: 'Timur’s forces reach the Aegean. European states face an unprecedented threat.' },
          { horizon: 'First decade', text: 'A Timurid power in Anatolia and the Balkans might fragment after his death, as his actual empire largely did.' },
          { horizon: 'Long run', text: 'The Ottoman dynasty might never re-emerge as a dominant power. The consequences are unknowable.' },
        ],
      },
    ],
  },
  {
    id: 'constantinople-1453',
    title: 'Fall of Constantinople',
    year: 1453,
    dateLabel: '29 May 1453',
    era: 'Medieval',
    region: 'Europe',
    place: 'Constantinople (Istanbul)',
    lat: 41.0082,
    lng: 28.9784,
    summary:
      'After a siege of about seven weeks, Ottoman forces under Sultan Mehmed II captured Constantinople, ending the Byzantine Empire. The last emperor, Constantine XI, died in the fighting.',
    verifiedFacts: [
      'The siege began in early April 1453 and ended on 29 May.',
      'The Ottomans used very large cannon against the Theodosian Walls.',
      'Defenders were far outnumbered; estimates of both sides vary widely among sources.',
      'The Genoese commander Giovanni Giustiniani Longo was wounded during the final assault and left his post. Accounts of exactly how this affected the defence differ.',
      'Constantine XI died in the final fighting.',
    ],
    pivot: {
      question: 'Would the defence have held if its key commander had stayed at his post during the final assault?',
      actual: 'Giustiniani was wounded and withdrawn, and the defence collapsed soon afterwards.',
      alternatives: [
        'Giustiniani is not wounded.',
        'A Western relief fleet arrives.',
        'The Ottomans abandon the siege.',
      ],
    },
    factors: [
      'The Theodosian Walls had defended the city for a thousand years.',
      'Western European powers promised but did not send major relief.',
      'The Ottomans had developed large siege artillery.',
      'Venetian and Genoese contingents had their own political calculations.',
    ],
    related: ['ankara-1402'],
    scenarios: [
      {
        id: 'constantinople-holds',
        title: 'The walls hold one more time',
        premium: false,
        premise: 'The final assault of 29 May fails and Mehmed lifts the siege.',
        assumptions: ['Mehmed’s position in the Ottoman court is not fatally undermined.'],
        chapters: [
          { horizon: 'First year', text: 'A diminished Byzantine state survives, holding a city of far fewer inhabitants than in its prime.' },
          { horizon: 'First decade', text: 'The Ottomans may renew the siege, but a failed campaign raises political costs for Mehmed.' },
          { horizon: 'Long run', text: 'The city might still fall within a few decades. A decisive change to world history would depend on whether a Christian power gained a durable foothold in the region.' },
        ],
      },
      {
        id: 'constantinople-western-relief',
        title: 'The relief fleet arrives',
        premium: true,
        premise: 'A combined Venetian-Genoese relief fleet reaches the city in time.',
        assumptions: ['Western rivalries are set aside for a moment.'],
        chapters: [
          { horizon: 'First year', text: 'The siege is broken or at least the harbour reopened.' },
          { horizon: 'First decade', text: 'Renewed western support for what remains of Byzantium could shift the Aegean balance.' },
          { horizon: 'Long run', text: 'Greek scholars continue to leave for Italy, perhaps at a slower rate. The influence on Renaissance learning would be altered in unknown ways.' },
        ],
      },
    ],
  },
  {
    id: 'waterloo-1815',
    title: 'Battle of Waterloo',
    year: 1815,
    dateLabel: '18 June 1815',
    era: 'Modern',
    region: 'Europe',
    place: 'Waterloo, Belgium',
    lat: 50.68,
    lng: 4.412,
    summary:
      'Napoleon’s French army was defeated by an Anglo-allied army under the Duke of Wellington and a Prussian army under Field Marshal Blücher, ending Napoleon’s Hundred Days.',
    verifiedFacts: [
      'Marshal Grouchy had been detached with about 33,000 men to pursue the Prussians and did not reach the battlefield in time.',
      'Prussian forces arrived on Napoleon’s right flank in the afternoon and evening.',
      'Napoleon abdicated for the second time on 22 June 1815.',
      'He was exiled to Saint Helena, where he died in 1821.',
    ],
    pivot: {
      question: 'Should Grouchy have marched toward the sound of the guns?',
      actual: 'Grouchy continued his pursuit and fought the Prussian rearguard at Wavre.',
      alternatives: [
        'Grouchy marches to Waterloo.',
        'The French begin the attack earlier in the day.',
        'The Prussian march is delayed.',
      ],
    },
    factors: [
      'Rain the previous night left the ground heavy, delaying the start of the battle.',
      'The Allied and Prussian armies were in close communication.',
      'The coalition powers had committed to opposing Napoleon with overwhelming forces.',
      'France’s political support for Napoleon was fragile.',
    ],
    scenarios: [
      {
        id: 'waterloo-grouchy',
        title: 'Grouchy arrives',
        premium: false,
        premise: 'Grouchy marches to the sound of the guns and engages the Prussians on the field.',
        assumptions: ['Grouchy acts on initiative against his orders.'],
        chapters: [
          { horizon: 'First year', text: 'A closer, bloodier battle. Napoleon might hold the field, but the coalition’s other armies were still advancing toward France.' },
          { horizon: 'First decade', text: 'Even a French victory at Waterloo leaves the strategic problem unresolved: Austrian and Russian armies are still coming.' },
          { horizon: 'Long run', text: 'The most likely long-term result may still be Napoleon’s fall, though possibly with different terms for France.' },
        ],
      },
      {
        id: 'waterloo-negotiated',
        title: 'A negotiated peace',
        premium: true,
        premise: 'Napoleon wins decisively in Belgium and coalition governments agree to talks.',
        assumptions: ['Coalition unity fractures after a first defeat.'],
        chapters: [
          { horizon: 'First year', text: 'A shaky armistice. Napoleon would still face a hostile Europe and domestic opposition.' },
          { horizon: 'First decade', text: 'A restored French position could change the Congress of Vienna settlement.' },
          { horizon: 'Long run', text: 'The nineteenth-century European order would differ, but any specific outcome is conjecture.' },
        ],
      },
    ],
  },
  {
    id: 'sarajevo-1914',
    title: 'Assassination of Archduke Franz Ferdinand',
    year: 1914,
    dateLabel: '28 June 1914',
    era: 'Modern',
    region: 'Europe',
    place: 'Sarajevo, Bosnia',
    lat: 43.8563,
    lng: 18.4131,
    summary:
      'Archduke Franz Ferdinand, heir to the Austro-Hungarian throne, and his wife Sophie were shot dead in Sarajevo by Gavrilo Princip. The July Crisis that followed led to the First World War.',
    verifiedFacts: [
      'Earlier that morning, a bomb thrown at the motorcade by Nedeljko Čabrinović failed to kill the Archduke.',
      'After the attack the motorcade took a wrong turn, and Princip, who was nearby, shot the Archduke and Sophie.',
      'Austria-Hungary received German backing in early July, delivered an ultimatum to Serbia on 23 July, and declared war on 28 July 1914.',
      'Alliance commitments then drew in Russia, Germany, France and Britain.',
    ],
    pivot: {
      question: 'Did the motorcade have to pass the spot where Princip happened to be?',
      actual: 'The driver took a wrong turn and stopped; Princip took his chance.',
      alternatives: [
        'The motorcade follows the revised route and the plot fails.',
        'The visit is cancelled after the morning bombing.',
        'Princip is arrested before the attack.',
      ],
    },
    factors: [
      'The alliance system tied several great powers to Serbia’s and Austria-Hungary’s quarrel.',
      'Germany’s early assurance of support emboldened Vienna.',
      'Military mobilisation plans were rigid and time-sensitive.',
      'Balkan nationalism and the Bosnian annexation of 1908 had left lasting tensions.',
    ],
    scenarios: [
      {
        id: 'sarajevo-no-war',
        title: 'The wrong turn that wasn’t',
        premium: false,
        premise: 'The assassination fails and no immediate crisis follows.',
        assumptions: ['Other crises do not trigger a similar chain reaction.'],
        chapters: [
          { horizon: 'First year', text: 'A visit that ends as an embarrassing security episode. Tension between Vienna and Belgrade continues.' },
          { horizon: 'First decade', text: 'Some historians argue the European great powers were heading toward a major war anyway; others disagree. Either is plausible.' },
          { horizon: 'Long run', text: 'If a delayed or avoided war happens, the political shape of twentieth-century Europe would differ. Speculative.' },
        ],
      },
      {
        id: 'sarajevo-franz-ferdinand-reign',
        title: 'Franz Ferdinand takes the throne',
        premium: true,
        premise: 'The Archduke survives and succeeds Franz Joseph, who died in 1916 in real history.',
        assumptions: ['Reform of the empire is attempted. Historians debate how far Franz Ferdinand intended to go.'],
        chapters: [
          { horizon: 'First year', text: 'A tense accession in a multi-national empire.' },
          { horizon: 'First decade', text: 'Federal reforms might ease or inflame nationalist movements. Hungarian elites would likely resist.' },
          { horizon: 'Long run', text: 'A reformed Danubian monarchy in the 1920s is conceivable but far from certain.' },
        ],
      },
    ],
  },
  {
    id: 'cuban-missile-1962',
    title: 'Cuban Missile Crisis',
    year: 1962,
    dateLabel: '16–28 October 1962',
    era: 'Contemporary',
    region: 'Americas',
    place: 'Havana, Cuba / Washington, D.C.',
    lat: 23.1136,
    lng: -82.3666,
    summary:
      'A thirteen-day confrontation between the United States and the Soviet Union over Soviet nuclear missiles in Cuba. It ended when the Soviet Union agreed to withdraw them.',
    verifiedFacts: [
      'U-2 reconnaissance photographs revealed Soviet missile sites in Cuba, shown to President Kennedy on 16 October 1962.',
      'Kennedy announced a naval “quarantine” of Cuba on 22 October rather than launching an air strike or an invasion.',
      'On 27 October, a U-2 was shot down over Cuba and its pilot, Major Rudolf Anderson, was killed.',
      'The crisis was resolved on 28 October when Khrushchev agreed to withdraw the missiles. The U.S. also privately agreed to remove its Jupiter missiles from Turkey, a part of the deal that was kept secret for years.',
      'Declassified accounts say that Soviet submarine officer Vasili Arkhipov is reported to have opposed the launch of a nuclear torpedo from submarine B-59.',
    ],
    pivot: {
      question: 'Blockade, air strike or invasion?',
      actual: 'Kennedy chose a naval quarantine, leaving room for diplomacy.',
      alternatives: [
        'Kennedy orders air strikes on the missile sites.',
        'Kennedy orders an invasion of Cuba.',
        'The crisis is handled through secret diplomacy alone.',
      ],
    },
    factors: [
      'Both sides held large nuclear arsenals.',
      'Soviet forces in Cuba included tactical nuclear weapons.',
      'Communication between Washington and Moscow was slow.',
      'U.S. military leaders advised stronger action than Kennedy chose.',
    ],
    scenarios: [
      {
        id: 'cuba-air-strike',
        title: 'The air strike',
        premium: false,
        premise: 'Kennedy orders air strikes against missile sites on 22 October.',
        assumptions: ['Soviet forces in Cuba react as they were authorised to.'],
        chapters: [
          { horizon: 'First week', text: 'U.S. strikes would likely kill Soviet personnel. Moscow faces pressure to retaliate, perhaps against Berlin or Turkey.' },
          { horizon: 'First year', text: 'Escalation to a wider conflict is possible, though both sides had strong reasons to avoid it.' },
          { horizon: 'Long run', text: 'Any outcome from limited war to nuclear exchange is conceivable; it would reshape the Cold War completely.' },
        ],
      },
      {
        id: 'cuba-secret-diplomacy',
        title: 'Quiet diplomacy only',
        premium: true,
        premise: 'The crisis is resolved privately without public confrontation.',
        assumptions: ['Both leaders are able to trade concessions without public pressure.'],
        chapters: [
          { horizon: 'First year', text: 'Without a public crisis there is less of an impetus for crisis-management communication.' },
          { horizon: 'First decade', text: 'The “hotline” established in 1963 might not exist, or exist later.' },
          { horizon: 'Long run', text: 'Arms-control history from 1963 onwards could look quite different.' },
        ],
      },
    ],
  },
  {
    id: 'apollo-11',
    title: 'Apollo 11 Moon Landing',
    year: 1969,
    dateLabel: '20 July 1969',
    era: 'Contemporary',
    region: 'Americas',
    place: 'Kennedy Space Center, Florida (launch) / Sea of Tranquility',
    lat: 28.5729,
    lng: -80.649,
    summary:
      'Neil Armstrong and Buzz Aldrin landed the lunar module Eagle on the Moon while Michael Collins orbited above in the command module.',
    verifiedFacts: [
      'During descent, the guidance computer issued program alarms (1201 and 1202). Mission Control judged them acceptable and allowed the descent to continue.',
      'Armstrong took manual control to fly past a boulder-strewn area and landed with little fuel remaining.',
      'A contingency speech, “In Event of Moon Disaster”, had been drafted for the President in case the astronauts could not return.',
      'All three astronauts returned safely to Earth on 24 July 1969.',
    ],
    pivot: {
      question: 'Continue the descent or abort when the program alarms sounded?',
      actual: 'Ground controllers gave a “go” and the landing continued.',
      alternatives: [
        'Controllers call an abort.',
        'The astronauts land with insufficient fuel.',
        'The lunar module cannot lift off again.',
      ],
    },
    factors: [
      'Fuel margins on the descent were very thin.',
      'The programme had a fixed political deadline set in 1961.',
      'Rendezvous in lunar orbit depended on a single ascent engine.',
      'The Soviet lunar programme had its own difficulties.',
    ],
    scenarios: [
      {
        id: 'apollo-abort',
        title: 'Abort and try again',
        premium: false,
        premise: 'The landing is aborted and the crew returns to orbit.',
        assumptions: ['The abort is safe and the next attempt follows within months.'],
        chapters: [
          { horizon: 'First year', text: 'A delayed landing, probably before the end of 1969 or in early 1970. The “by the end of the decade” goal might still be met.' },
          { horizon: 'First decade', text: 'The programme’s later missions proceed with extra caution.' },
          { horizon: 'Long run', text: 'Public memory would credit a different set of names with “first steps”.' },
        ],
      },
      {
        id: 'apollo-stranded',
        title: 'Tragedy at Tranquility',
        premium: true,
        premise: 'The lunar module cannot return, as the contingency plan feared.',
        assumptions: ['Treated here as a sombre thought experiment.'],
        chapters: [
          { horizon: 'First year', text: 'A national mourning and an investigation. The programme is suspended.' },
          { horizon: 'First decade', text: 'Public support for crewed spaceflight could erode significantly.' },
          { horizon: 'Long run', text: 'Human spaceflight might have shifted toward Earth-orbit stations for decades.' },
        ],
      },
    ],
  },
  {
    id: 'berlin-wall-1989',
    title: 'Fall of the Berlin Wall',
    year: 1989,
    dateLabel: '9 November 1989',
    era: 'Contemporary',
    region: 'Europe',
    place: 'Berlin, Germany',
    lat: 52.5163,
    lng: 13.3777,
    summary:
      'After a confused press conference announced new travel rules, crowds gathered at Berlin Wall checkpoints. Border guards opened the gates and East Germans crossed freely for the first time in decades.',
    verifiedFacts: [
      'East German official Günter Schabowski announced new travel regulations at a press conference and, asked when they took effect, said that as far as he knew it was immediately.',
      'Crowds gathered at checkpoints that evening.',
      'At Bornholmer Straße, the commander Harald Jäger opened the barrier late in the evening.',
      'Germany was formally reunified on 3 October 1990.',
    ],
    pivot: {
      question: 'Would the guards have used force against the crowds?',
      actual: 'Jäger opened the gate, and other crossings followed.',
      alternatives: [
        'Guards fire on the crowd.',
        'The regulations are announced the next morning as planned.',
        'Soviet troops intervene.',
      ],
    },
    factors: [
      'Mass protests across East Germany had been growing for weeks.',
      'The Soviet leadership under Gorbachev had signalled it would not intervene.',
      'Hungary had opened its border to Austria earlier in 1989.',
      'The East German leadership was divided and uncertain.',
    ],
    scenarios: [
      {
        id: 'berlin-crackdown',
        title: 'The gates stay shut',
        premium: false,
        premise: 'Border guards hold the line by force or by orders from above.',
        assumptions: ['Orders to use force are given and followed.'],
        chapters: [
          { horizon: 'First year', text: 'A violent night would likely harden opposition. Exit through other routes continues.' },
          { horizon: 'First decade', text: 'With the Soviet position as it was, a prolonged hardline regime appears difficult to sustain.' },
          { horizon: 'Long run', text: 'Reunification would likely still occur, though maybe later and more painfully.' },
        ],
      },
      {
        id: 'berlin-orderly',
        title: 'The planned morning',
        premium: true,
        premise: 'The rules are announced as planned the next morning with an orderly procedure.',
        assumptions: ['The miscommunication at the press conference does not happen.'],
        chapters: [
          { horizon: 'First year', text: 'A managed opening, perhaps with exit visas still required.' },
          { horizon: 'First decade', text: 'The pace of change is slower, but pressure from the streets would likely continue.' },
          { horizon: 'Long run', text: 'Unification might follow a different timetable and terms.' },
        ],
      },
    ],
  },
]

export const EVENTS: HistoricalEvent[] = [...BASE_EVENTS, ...EXTRA_EVENTS]

export const EVENT_BY_ID: Record<string, HistoricalEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]))
export const REGIONS = Array.from(new Set(EVENTS.map((e) => e.region))).sort()
export const ERAS = ['Ancient', 'Medieval', 'Early Modern', 'Modern', 'Contemporary'] as const
