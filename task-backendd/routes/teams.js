const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const { authorizeTeam } = require('../middleware/authorize');

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
            members: [{
                user: req.user.id,
                role: 'Admin'
            }]
        });

        await newTeam.save();
        const populatedTeam = await Team.findById(newTeam._id).populate('members.user', 'username');
        res.status(201).json(populatedTeam);
    } catch (err) {
        console.error("Error creating team:", err);
        res.status(500).json({ error: "Server error while creating team." });
    }
});

// GET /api/teams - Get all teams the current user is a member of
router.get('/', async (req, res) => {
    try {
        const teams = await Team.find({ 'members.user': req.user.id })
            .populate('members.user', 'username')
            .populate('createdBy', 'username');

        res.json(teams);
    } catch (err) {
        console.error("Error fetching teams:", err);
        res.status(500).json({ error: "Failed to fetch teams." });
    }
});

// PUT /api/teams/:teamId/invite - Invite a friend to a team (Requires Admin role & Friend verification)
router.put('/:teamId/invite', authorizeTeam('Admin'), async (req, res) => {
    try {
        const { friendId } = req.body;
        if (!friendId) {
            return res.status(400).json({ error: "Friend ID is required." });
        }

        const team = req.team;

        // Verify friend exists and is in inviter's accepted friends list
        const inviter = await User.findById(req.user.id);
        const isAcceptedFriend = inviter.friends.some(f => f.user.equals(friendId) && f.status === 'accepted');

        if (!isAcceptedFriend) {
            return res.status(403).json({ error: "You can only invite users who are in your accepted friends list." });
        }

        // Check if the user is already a member of the team
        const isAlreadyMember = team.members.some(member => member.user.equals(friendId));
        if (isAlreadyMember) {
            return res.status(400).json({ error: "This user is already a member of the team." });
        }

        // Add member
        team.members.push({ user: friendId, role: 'Member' });
        await team.save();

        const updatedTeam = await Team.findById(team._id)
            .populate('members.user', 'username')
            .populate('createdBy', 'username');
            
        res.json(updatedTeam);
    } catch (err) {
        console.error("Error inviting user to team:", err);
        res.status(500).json({ error: "Failed to invite user." });
    }
});

module.exports = router;
