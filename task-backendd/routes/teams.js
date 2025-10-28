const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');

// POST /api/teams - Create a new team
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Team name is required." });
        }

        const newTeam = new Team({
            name: name.trim(),
            createdBy: req.user.id,
            // The creator is automatically added as the first member and an Admin
            members: [{
                user: req.user.id,
                role: 'Admin'
            }]
        });

        await newTeam.save();
        res.status(201).json(newTeam);
    } catch (err) {
        console.error("Error creating team:", err);
        res.status(500).json({ error: "Server error while creating team." });
    }
});

// GET /api/teams - Get all teams the current user is a member of
router.get('/', async (req, res) => {
    try {
        const teams = await Team.find({ 'members.user': req.user.id })
            .populate('members.user', 'username') // Populate member usernames
            .populate('createdBy', 'username'); // Populate creator username

        res.json(teams);
    } catch (err) {
        console.error("Error fetching teams:", err);
        res.status(500).json({ error: "Failed to fetch teams." });
    }
});

// PUT /api/teams/:teamId/invite - Invite a friend to a team
router.put('/:teamId/invite', async (req, res) => {
    try {
        const { teamId } = req.params;
        const { friendId } = req.body; // The ID of the user being invited

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ error: "Team not found." });
        }

        // Security Check: Ensure the person inviting is a member of the team
        const isMember = team.members.some(member => member.user.equals(req.user.id));
        if (!isMember) {
            return res.status(403).json({ error: "You are not a member of this team." });
        }

        // Check if the friend is already a member
        const isAlreadyMember = team.members.some(member => member.user.equals(friendId));
        if (isAlreadyMember) {
            return res.status(400).json({ error: "This user is already a member of the team." });
        }

        // Add the new member
        team.members.push({ user: friendId, role: 'Member' });
        await team.save();

        const updatedTeam = await Team.findById(teamId).populate('members.user', 'username');
        res.json(updatedTeam);

    } catch (err) {
        console.error("Error inviting user to team:", err);
        res.status(500).json({ error: "Failed to invite user." });
    }
});

module.exports = router;

