import { describe, it, expect } from 'vitest';
import { SnakeCaseNamingStrategy } from '../src/config/SnakeCaseNamingStrategy';


describe('SnakeCaseNamingStrategy', () => {
    const strategy = new SnakeCaseNamingStrategy();


    describe('tableName', () => {
        it('should convert class name to snake_case', () => {
            expect(strategy.tableName('UserProfile', '')).toBe('user_profile');
            expect(strategy.tableName('OrderItem', '')).toBe('order_item');
        });


        it('should use custom name when provided', () => {
            expect(strategy.tableName('UserProfile', 'custom_table')).toBe('custom_table');
        });
    });


    describe('columnName', () => {
        it('should convert property name to snake_case', () => {
            expect(strategy.columnName('firstName', '', [])).toBe('first_name');
            expect(strategy.columnName('createdAt', '', [])).toBe('created_at');
        });


        it('should use custom name when provided', () => {
            expect(strategy.columnName('firstName', 'custom_column', [])).toBe('custom_column');
        });


        it('should handle embedded prefixes', () => {
            expect(strategy.columnName('street', '', ['homeAddress'])).toBe('home_address_street');
            expect(strategy.columnName('zipCode', '', ['homeAddress', 'postal'])).toBe('home_address_postal_zip_code');
        });
    });


    describe('relationName', () => {
        it('should convert relation name to snake_case', () => {
            expect(strategy.relationName('userProfile')).toBe('user_profile');
            expect(strategy.relationName('orderItems')).toBe('order_items');
        });
    });


    describe('joinColumnName', () => {
        it('should create snake_case join column name', () => {
            expect(strategy.joinColumnName('user', 'id')).toBe('user_id');
            expect(strategy.joinColumnName('orderItem', 'productId')).toBe('order_item_product_id');
        });
    });


    describe('joinTableName', () => {
        it('should create snake_case join table name', () => {
            expect(strategy.joinTableName('user', 'role', 'roles', 'users'))
                .toBe('user_roles_role');
            expect(strategy.joinTableName('order', 'product', 'products', 'orders'))
                .toBe('order_products_product');
        });


        it('should replace dots with underscores in property name', () => {
            expect(strategy.joinTableName('user', 'permission', 'roles.permissions', 'users'))
                .toBe('user_roles_permissions_permission');
        });
    });


    describe('joinTableColumnName', () => {
        it('should create snake_case join table column name', () => {
            expect(strategy.joinTableColumnName('user', 'id')).toBe('user_id');
            expect(strategy.joinTableColumnName('orderItem', 'productId')).toBe('order_item_product_id');
        });


        it('should use custom column name when provided', () => {
            expect(strategy.joinTableColumnName('user', 'id', 'custom_id')).toBe('user_custom_id');
        });
    });


    describe('classTableInheritanceParentColumnName', () => {
        it('should create snake_case parent column name', () => {
            expect(strategy.classTableInheritanceParentColumnName('baseEntity', 'id'))
                .toBe('base_entity_id');
            expect(strategy.classTableInheritanceParentColumnName('parentClass', 'uuid'))
                .toBe('parent_class_uuid');
        });
    });


    describe('eagerJoinRelationAlias', () => {
        it('should create alias with double underscore', () => {
            expect(strategy.eagerJoinRelationAlias('user', 'profile')).toBe('user__profile');
            expect(strategy.eagerJoinRelationAlias('order', 'items.product')).toBe('order__items_product');
        });

        it('should replace all dots in nested relations', () => {
            expect(strategy.eagerJoinRelationAlias('user', 'profile.address.city'))
                .toBe('user__profile_address_city');
        });
    });
});
