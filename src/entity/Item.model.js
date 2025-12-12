import { DataTypes } from 'sequelize';
import sequelize from './db.config.js';

export const Item = sequelize.define('Item', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    description: { 
        type: DataTypes.TEXT,
        allowNull: true 
    },
    photo: { 
        type: DataTypes.TEXT,
        allowNull: true 
    },
}, { 
    tableName: 'items', 
    freezeTableName: true, 
    timestamps: false 
});