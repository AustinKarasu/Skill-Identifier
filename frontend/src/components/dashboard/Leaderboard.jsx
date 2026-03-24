import { motion } from 'framer-motion'
import { Award, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { leaderboardService } from '../../api/services/leaderboardService'

export default function Leaderboard() {
  const [topPerformers, setTopPerformers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [skillLeaders, setSkillLeaders] = useState([])
  const [achievements, setAchievements] = useState([])

  useEffect(() => {
    let mounted = true

    const loadLeaderboard = async () => {
      const summary = await leaderboardService.getSummary()
      if (!mounted) return
      setTopPerformers(summary.topPerformers)
      setLeaderboard(summary.leaderboard)
      setSkillLeaders(summary.skillLeaders)
      setAchievements(summary.achievements)
    }

    loadLeaderboard()

    return () => {
      mounted = false
    }
  }, [])

  const getMedalColor = (rank) => {
    switch (rank) {
      case 1:
        return 'from-yellow-500 to-yellow-600'
      case 2:
        return 'from-gray-300 to-gray-400'
      case 3:
        return 'from-orange-400 to-orange-500'
      default:
        return 'from-gray-700 to-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white">Leaderboard</h1>
        <p className="text-gray-400 mt-2">Recognize top performers and skill leaders.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topPerformers.map(({ rank, name, score, skills, achievements: ach, avatar }) => (
          <motion.div key={rank} whileHover={{ scale: 1.05 }} className={`relative bg-gradient-to-b ${getMedalColor(rank)} rounded-lg p-6 border border-gray-700 text-center overflow-hidden`}>
            <div className="absolute top-2 right-2 text-sm font-bold">#{rank}</div>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-black/20 text-white font-bold flex items-center justify-center text-lg mb-4">{avatar}</div>
              <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
              <p className="text-gray-800 text-sm font-medium mb-4">Rank #{rank}</p>
              <div className="space-y-2">
                <div className="flex justify-center space-x-4 text-sm">
                  <span className="font-semibold text-white">Score: {score}</span>
                  <span className="font-semibold text-white">Skills: {skills}</span>
                </div>
                <div className="flex justify-center space-x-1">
                  {[...Array(ach)].map((_, i) => (
                    <span key={i} className="text-lg">*</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-900 border border-gray-700 rounded-lg p-6 overflow-x-auto">
        <h3 className="text-lg font-bold text-white mb-6">Full Leaderboard</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Rank</th>
              <th className="text-left py-4 px-4 text-gray-300 font-semibold text-sm">Name</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Department</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Score</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Skills</th>
              <th className="text-center py-4 px-4 text-gray-300 font-semibold text-sm">Points</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <motion.tr key={entry.rank} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + index * 0.05 }} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-bold text-lg">#{entry.rank}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <p className="text-white font-semibold">{entry.name}</p>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-gray-300 text-sm">{entry.department}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="px-3 py-1 bg-white text-black text-sm font-bold rounded-lg">{entry.score}/5.0</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-white font-semibold">{entry.skills}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-green-400 font-bold">{entry.points}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center space-x-2">
            <Award className="w-5 h-5" />
            <span>Skill Leaders</span>
          </h3>
          <div className="space-y-4">
            {skillLeaders.map(({ skill, leader, score }, index) => (
              <motion.div key={skill} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + index * 0.05 }} className="flex items-center justify-between p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
                <div>
                  <p className="text-white font-semibold">{skill}</p>
                  <p className="text-gray-400 text-sm">{leader}</p>
                </div>
                <span className="px-3 py-1 bg-white text-black text-sm font-bold rounded-lg">{score}/5</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span>Achievements</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {achievements.map(({ id, name, count, icon }) => (
              <motion.div key={id} whileHover={{ scale: 1.05 }} className="p-4 rounded-lg bg-gray-800 border border-gray-700 text-center hover:border-white transition-colors cursor-pointer">
                <div className="text-4xl mb-2">{icon}</div>
                <p className="text-white font-semibold text-sm">{name}</p>
                <p className="text-gray-400 text-xs mt-1">{count} members</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
