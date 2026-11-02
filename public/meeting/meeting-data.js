window.MEETING = {
  "title": "AEGIS Annual Meeting",
  "targetSeconds": 600,
  "version": 1,
  "people": {
    "athena": {
      "name": "Athena",
      "role": "Chief Intelligence Officer",
      "location": "AEGIS headquarters",
      "image": "../assets/athena-executive.jpg",
      "color": "#b8d2df",
      "voice": "Approved office performance",
      "initials": "A"
    },
    "research": {
      "name": "Dr. Mira Chen",
      "role": "Chief Research Officer",
      "location": "Sentinel research laboratory",
      "image": "assets/mira-chen.png",
      "color": "#9fd7d3",
      "voice": "Leslie",
      "initials": "MC"
    },
    "field": {
      "name": "Elias Ward",
      "role": "Director of Field Training",
      "location": "AEGIS proving ground",
      "image": "assets/elias-ward.png",
      "color": "#d8bc91",
      "voice": "Benjamin",
      "initials": "EW"
    },
    "operations": {
      "name": "Rowan Vale",
      "role": "Director of Simulation Operations",
      "location": "Days Gone Quiet · Grayhaven station",
      "image": "assets/rowan-vale.png",
      "color": "#c2c6a2",
      "voice": "James",
      "initials": "RV"
    }
  },
  "chapters": [
    {
      "id": "welcome",
      "name": "The mandate",
      "short": "Opening",
      "seconds": 45,
      "question": null,
      "asker": "Dane",
      "takeaway": "The world is fictional. The experiment is real.",
      "turns": [
        {
          "id": "01",
          "speaker": "athena",
          "visual": "opening",
          "title": "Intelligence that learns to act.",
          "eyebrow": "Annual shareholder meeting",
          "seconds": 45,
          "text": "Welcome to AEGIS Dynamics. Today, you are our shareholders. Our subject is reinforcement learning: how a system can learn what to do through experience. I am Athena. My team will take you from headquarters to our training ground and into Days Gone Quiet, where three agents face one shared mission. The company and its executives are fictional. The training records we will examine are real. Dane and his project partner direct the work, choose the experiments, and decide what the evidence supports."
        }
      ]
    },
    {
      "id": "learning",
      "name": "Learning through experience",
      "short": "01 / Learning",
      "seconds": 80,
      "question": "Athena, what are we actually teaching these agents?",
      "asker": "Dane",
      "takeaway": "Observe → act → receive feedback → update the policy.",
      "turns": [
        {
          "id": "02",
          "speaker": "athena",
          "visual": "loop",
          "title": "From instructions to experience.",
          "eyebrow": "Question 01 · The learning process",
          "seconds": 15,
          "text": "We are teaching a policy: a way to choose actions from observations. Mira, explain what changes when an agent learns.",
          "video": "video/02.mp4"
        },
        {
          "id": "03",
          "speaker": "research",
          "visual": "loop",
          "title": "Every action changes the next decision.",
          "eyebrow": "Sentinel research laboratory",
          "seconds": 34,
          "text": "An agent observes its situation, chooses an action, and receives a reward signal. During training, the learning algorithm uses experience to adjust its policy toward greater expected return over time. That last part matters. The best immediate reward may not lead to the best final outcome. A route that looks slow now could be the one that gets the entire team home."
        },
        {
          "id": "04",
          "speaker": "research",
          "visual": "reward",
          "title": "The reward is our design decision.",
          "eyebrow": "What the agent is asked to optimize",
          "seconds": 31,
          "text": "We choose what the agent can observe, what it can do, and how feedback is assigned. If we reward the wrong behavior, training can strengthen the wrong habit. The learning system does not automatically understand our intention. We must check whether the behavior it learns actually serves the mission. In this project, the characters speaking are presenters. The Unity policies are the systems being trained."
        }
      ]
    },
    {
      "id": "mission",
      "name": "One mission. Three roles.",
      "short": "02 / Field report",
      "seconds": 85,
      "question": "Can we see what learning looks like in Days Gone Quiet?",
      "asker": "Partner",
      "takeaway": "Local actions must add up to a complete team mission.",
      "turns": [
        {
          "id": "05",
          "speaker": "athena",
          "visual": "team",
          "title": "Connecting to Grayhaven.",
          "eyebrow": "Field report · Days Gone Quiet",
          "seconds": 16,
          "text": "Rowan is reporting from our Days Gone Quiet simulation station. Rowan, show the shareholders what the team must accomplish."
        },
        {
          "id": "06",
          "speaker": "operations",
          "visual": "team",
          "title": "Three capabilities. One dependency chain.",
          "eyebrow": "Grayhaven simulation station",
          "seconds": 34,
          "text": "Rick retrieves supplies. Scout reports the safer route. Negan protects the team. Supply Run connects the prison depot to the barn through two possible routes and a sheltered waystation. Success means traveling out, regrouping, collecting supplies, following the return route, and bringing all three survivors home. Finding the cargo is only part of the job. A delivery counts only when the entire mission is complete."
        },
        {
          "id": "07",
          "speaker": "operations",
          "visual": "mission",
          "title": "The handoff is part of the task.",
          "eyebrow": "Supply Run · Mission structure",
          "seconds": 35,
          "text": "Each role has different abilities and observations. The team must make compatible decisions over time. This creates a useful learning problem: progress by one agent does not guarantee progress by the group. Our schematic shows the mission structure, not a recording of an agent moving. We use recorded milestone events to examine what actually happened in a test."
        }
      ]
    },
    {
      "id": "training",
      "name": "Practice is not proof",
      "short": "03 / Evidence",
      "seconds": 80,
      "question": "Why can’t we just give them more training?",
      "asker": "Dane",
      "takeaway": "Training steps and reward are not measures of reliable delivery.",
      "turns": [
        {
          "id": "08",
          "speaker": "athena",
          "visual": "comparison",
          "title": "What did the training establish?",
          "eyebrow": "Question 03 · Evidence review",
          "seconds": 15,
          "text": "The first Supply Run team reached about half a million saved training steps per role. Mira, what does that number tell us, and what does it leave unanswered?"
        },
        {
          "id": "09",
          "speaker": "research",
          "visual": "comparison",
          "title": "Scripted success ≠ learned success.",
          "eyebrow": "Two different kinds of evidence",
          "seconds": 33,
          "text": "It tells us how far that training run progressed. It does not establish mastery. Training combined reinforcement learning with behavior cloning from sixteen scripted practice trips. All sixteen demonstrations succeeded. But those were scripted examples, not independent achievements by the learned policy. The final saved team then completed zero successful deliveries in twenty-four test cases. Those are different tests of different things."
        },
        {
          "id": "10",
          "speaker": "research",
          "visual": "comparison",
          "title": "Measure the outcome you care about.",
          "eyebrow": "Frozen-policy evaluation",
          "seconds": 32,
          "text": "Evaluation holds the saved policy fixed and measures its behavior. We can examine delivery, survival, and intermediate milestones instead of assuming that a higher reward or more training means a capable team. This small test suite helps diagnose problems in these recorded conditions. It is not a broad estimate of reliability, and it does not prove that cooperation outperforms an appropriate baseline."
        }
      ]
    },
    {
      "id": "failure",
      "name": "The failure that matters",
      "short": "04 / Diagnosis",
      "seconds": 110,
      "question": "Where does the team break down, and what do we learn from that?",
      "asker": "Partner",
      "takeaway": "Find the bottleneck before choosing the next experiment.",
      "turns": [
        {
          "id": "11",
          "speaker": "athena",
          "visual": "failures",
          "title": "Bring up the final evaluation.",
          "eyebrow": "Question 04 · Failure review",
          "seconds": 14,
          "text": "Rowan, show us where the final saved team stopped. Then Mira will explain how that changes the research plan."
        },
        {
          "id": "12",
          "speaker": "operations",
          "visual": "failures",
          "title": "Regrouping is the dominant bottleneck.",
          "eyebrow": "Final saved team · 24 test cases",
          "seconds": 33,
          "text": "Eighteen of the twenty-four failed tests ended at regrouping. Five ended at reconnaissance, and one at the outbound route. These counts cover the final saved team only. They tell us where the mission stopped, not every cause of the failure. We need to inspect the observations, movement, and reward design before claiming we know exactly why."
        },
        {
          "id": "13",
          "speaker": "operations",
          "visual": "timeline",
          "title": "A route report is not a delivery.",
          "eyebrow": "One recorded test · Milestone reconstruction",
          "seconds": 32,
          "text": "In the selected test, Scout reported a route almost immediately. Rick reached the route around forty seconds later. The episode timed out at roughly four minutes, still at regrouping. Cargo collection and return milestones were never reached. This timeline is reconstructed from recorded events. We do not have movement footage for this case, so the display does not invent a replay."
        },
        {
          "id": "14",
          "speaker": "research",
          "visual": "diagnosis",
          "title": "Change the practice. Test the hypothesis.",
          "eyebrow": "Proposed next experiment",
          "seconds": 31,
          "text": "The next experiment should target regrouping with focused practice and corrective demonstrations, including the protective actions missing from the earlier examples. Then we repeat the same diagnostic cases. We also need separate, unseen conditions to test generalization. A better result is possible, but it must be measured. The proposal is a hypothesis, not a promised improvement."
        }
      ]
    },
    {
      "id": "applications",
      "name": "Beyond the simulation",
      "short": "05 / Implications",
      "seconds": 90,
      "question": "Where could this kind of learning be useful outside a game?",
      "asker": "Dane",
      "takeaway": "The decision structure can be relevant beyond the fictional world.",
      "turns": [
        {
          "id": "15",
          "speaker": "athena",
          "visual": "applications",
          "title": "Connecting to the proving ground.",
          "eyebrow": "Field report · AEGIS training range",
          "seconds": 15,
          "text": "Elias, connect the simulation to practical decisions. What should the shareholders take away from this work?"
        },
        {
          "id": "16",
          "speaker": "field",
          "visual": "applications",
          "title": "Decisions unfold over time.",
          "eyebrow": "AEGIS proving ground · Fictional setting",
          "seconds": 37,
          "text": "Think about robots coordinating in a warehouse, an inspection vehicle balancing coverage with battery use, or a response team operating with incomplete information. An action changes what becomes possible next. These are potential settings for sequential decision-making methods, including reinforcement learning when the problem and constraints suit it. The value is in learning useful behavior under a clear objective, then testing whether it remains useful when conditions change."
        },
        {
          "id": "17",
          "speaker": "field",
          "visual": "transfer",
          "title": "Simulation is a beginning.",
          "eyebrow": "What transfer would require",
          "seconds": 38,
          "text": "A successful game policy would not automatically work in the real world. Sensors, physics, people, and failure costs all change. Practical work needs appropriate constraints, realistic testing, and human oversight. This project teaches a transferable engineering process: define the objective, create useful experience, inspect failures, and evaluate the result. We are demonstrating that process here. We are not claiming that these game agents are ready for deployment."
        }
      ]
    },
    {
      "id": "next",
      "name": "The next research decision",
      "short": "06 / Next experiment",
      "seconds": 70,
      "question": "What have we demonstrated, and what do we do next?",
      "asker": "Partner",
      "takeaway": "Choose a specific intervention and judge it against evidence.",
      "turns": [
        {
          "id": "18",
          "speaker": "athena",
          "visual": "next",
          "title": "A clear next decision.",
          "eyebrow": "Question 06 · Research direction",
          "seconds": 20,
          "text": "We have a working mission, recorded training, and a test suite that exposes a specific weakness. We have not demonstrated reliable delivery. Mira, give us the next decision in three steps."
        },
        {
          "id": "19",
          "speaker": "research",
          "visual": "next",
          "title": "Practice. Evaluate. Compare.",
          "eyebrow": "Proposed research sequence",
          "seconds": 32,
          "text": "First, build focused regrouping practice and improve the demonstrations. Second, evaluate the saved team again under the existing diagnostic conditions, while keeping independent tests for generalization. Third, compare complete mission outcomes and failure stages, not just reward. If the intervention does not help, we revise the hypothesis. Keeping a record of what failed is how the next experiment becomes more informative."
        },
        {
          "id": "20",
          "speaker": "athena",
          "visual": "ownership",
          "title": "Human judgment directs the research.",
          "eyebrow": "Project direction",
          "seconds": 18,
          "text": "Dane and his partner choose those experiments, check the outputs, and decide whether the results are useful. The tools extend their ability to investigate. The responsibility for the conclusions remains theirs."
        }
      ]
    },
    {
      "id": "closing",
      "name": "The takeaway",
      "short": "Closing",
      "seconds": 40,
      "question": null,
      "asker": "Dane",
      "takeaway": "RL is an experiment in behavior. Evidence decides whether it worked.",
      "turns": [
        {
          "id": "21",
          "speaker": "athena",
          "visual": "closing",
          "title": "The world is imagined.\nThe learning is real.",
          "eyebrow": "AEGIS Dynamics · Meeting adjourned",
          "seconds": 40,
          "text": "Take three ideas with you. Reinforcement learning changes behavior through experience. The objective and the practice environment shape what is learned. And only evaluation can tell us whether that behavior meets the goal. Our next breakthrough will begin with a better question and a test that can prove us wrong. Thank you for joining AEGIS. You can explore the recorded evidence and the project after the meeting. We are ready for your questions."
        }
      ]
    }
  ]
};
